import type { ArtistWatchData, FoundRelease, OnboardingCache, OnboardingLock, ResolvedArtist } from '../shared/types'
import { fetchFanCollection, rankArtistsFromCollection } from '../shared/collectionApi'
import { ARTIST_FETCH_CONCURRENCY, ARTIST_SCAN_DELAY_MS, BUTTON_RESET_DELAY_MS, ONBOARDING_CACHE_TTL_MS, ONBOARDING_LOCK_TTL_MS, RELEASE_FETCH_CONCURRENCY, RELEASE_FETCH_DELAY_MS } from '../shared/constants'
import { EVENTS } from '../shared/events'
import { StorageKeys } from '../shared/storageKeys'
import { strings } from '../shared/strings'
import { escapeHtml, fetchDocument, formatLocalDate, parseArtistUrl, safeUrl } from '../shared/utils'
import { toKey } from '../storage/storageCodec'
import { icon } from '../ui/icons'
import { BaseHandler } from './baseHandler'

export class ArtistWatchHandler extends BaseHandler {
  public watchedArtists: Record<string, ArtistWatchData> = {}
  private tabReleaseContent: Element | null = null

  public hasLoadingConditions(): boolean {
    return this.bandcampDomHandler.isOwnAccountPage() || this.bandcampDomHandler.isArtistPage() || this.bandcampDomHandler.isAlbumPage()
  }

  protected setupEventListeners(): void {
    // Listen for manual scan requests
    this.onEvent(EVENTS.artists.scan, async () => {
      await this.scanAllWatchedArtists()
    })

    // Initialize label watch toggle on label/album pages
    this.onEvent(EVENTS.artists.loaded, () => {
      if (this.bandcampDomHandler.isArtistPage() || this.bandcampDomHandler.isAlbumPage()) {
        this.addArtistWatchToggle()
      }
    })

    // When new releases tab is loaded: add fetch button and watched-artist summary.
    // This event may fire before initStorageData completes (Promise.all race),
    // so addFetcherButton loads from storage itself if needed.
    this.onEvent<{ tabId: string }>(EVENTS.newReleases.tabLoaded, async (detail) => {
      await this.addFetcherButton(detail.tabId)
      this.addSummaryWatchedArtists()
    })
  }

  public async initStorageData(): Promise<void> {
    if (this.loadingConditionsMet === false) {
      return
    }
    this.watchedArtists = await this.getWatchedArtists()
    this.dispatchEvent(EVENTS.artists.loaded, { watchedArtists: this.watchedArtists })
  }

  public async getWatchedArtists(): Promise<Record<string, ArtistWatchData>> {
    const artists = await this.loadFromStorage<Record<string, ArtistWatchData>>(StorageKeys.watchedArtists, {})

    if (!this.validateObjectData<Record<string, ArtistWatchData>>(artists, 'Watched artists data is not an object:')) {
      return {}
    }

    return artists
  }

  private async saveWatchedArtists(): Promise<void> {
    await this.saveToStorage(StorageKeys.watchedArtists, this.watchedArtists)
  }

  private async addFetcherButton(tabId: string): Promise<void> {
    this.tabReleaseContent = document.querySelector<HTMLElement>(`#${tabId}-grid .inner`)

    if (this.tabReleaseContent === null) {
      return
    }

    // Guard against race with initStorageData (Promise.all doesn't guarantee order)
    if (Object.keys(this.watchedArtists).length === 0) {
      this.watchedArtists = await this.getWatchedArtists()
    }

    if (Object.keys(this.watchedArtists).length === 0) {
      void this.showOnboarding(tabId)
      return
    }

    // Then add classic button to fetch new releases from watched artists
    let button = this.tabReleaseContent?.querySelector<HTMLButtonElement>('.bcd-fetch-watched-artists-btn')
    if (!button) {
      const textState = {
        idle: strings.t('artistWatch.fetchButton'),
        fetching: strings.t('artistWatch.fetching'),
        complete: strings.t('artistWatch.fetchComplete'),
      }
      const setLabel = (text: string): void => {
        button!.innerHTML = `${icon('refresh')}${text}`
      }

      button = document.createElement('button')
      button.type = 'button'
      button.className = 'bcd-fetch-watched-artists-btn'
      setLabel(textState.idle)

      const lastScan = await this.loadFromStorage<number | null>(StorageKeys.lastArtistScan, null)
      const wrapper = document.createElement('div')
      wrapper.className = 'bcd-fetch-wrapper'
      wrapper.appendChild(button)
      if (lastScan) {
        const lastScanEl = document.createElement('span')
        lastScanEl.className = 'bcd-last-scan'
        lastScanEl.textContent = strings.t('artistWatch.lastScan', [formatLocalDate(lastScan, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })])
        wrapper.appendChild(lastScanEl)
      }
      this.tabReleaseContent?.prepend(wrapper)

      button.addEventListener('click', async () => {
        button!.disabled = true
        setLabel(textState.fetching)

        await this.scanAllWatchedArtists()

        setLabel(textState.complete)

        let scanEl = wrapper.querySelector<HTMLSpanElement>('.bcd-last-scan')
        if (!scanEl) {
          scanEl = document.createElement('span')
          scanEl.className = 'bcd-last-scan'
          wrapper.appendChild(scanEl)
        }
        scanEl.textContent = strings.t('artistWatch.lastScan', [formatLocalDate(Date.now(), { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })])

        setTimeout(() => {
          button!.disabled = false
          setLabel(textState.idle)
        }, BUTTON_RESET_DELAY_MS)
      })
    }
  }

  private async showOnboarding(tabId: string): Promise<void> {
    if (!this.tabReleaseContent) {
      return
    }

    const container = document.createElement('div')
    container.className = 'bcd-onboarding'
    container.innerHTML = `
      <h3 class="bcd-onboarding-title">${strings.t('artistWatch.onboardingTitle')}</h3>
      <p class="bcd-onboarding-description">${strings.t('artistWatch.onboardingDescription')}</p>
      <div class="bcd-onboarding-loading">${strings.t('artistWatch.onboardingLoading')}</div>
    `
    this.tabReleaseContent.prepend(container)

    const loadingEl = container.querySelector('.bcd-onboarding-loading')!
    let resolved: ResolvedArtist[]

    const cached = await this.loadFromStorage<OnboardingCache | null>(StorageKeys.onboardingCache, null)
    if (cached && Date.now() - cached.timestamp < ONBOARDING_CACHE_TTL_MS) {
      resolved = cached.resolved
    }
    else {
      const lock = await this.loadFromStorage<OnboardingLock | null>(StorageKeys.onboardingLock, null)
      if (lock && Date.now() - lock.timestamp < ONBOARDING_LOCK_TTL_MS) {
        loadingEl.textContent = strings.t('artistWatch.onboardingLocked')
        return
      }

      const fanId = this.bandcampDomHandler.currentBlob?.fan_data?.fan_id
      if (!fanId) {
        return
      }

      await this.saveToStorage<OnboardingLock>(StorageKeys.onboardingLock, { timestamp: Date.now() })

      const collectionCount = this.bandcampDomHandler.currentBlob?.collection_count || 0

      // Phase 1: fetch collection
      const result = await fetchFanCollection(fanId, collectionCount)
      if (!result || result.items.length === 0) {
        await this.saveToStorage<OnboardingLock | null>(StorageKeys.onboardingLock, null)
        loadingEl.textContent = strings.t('artistWatch.onboardingEmpty')
        return
      }

      const ranked = rankArtistsFromCollection(result.items).slice(0, 50)
      resolved = ranked.map(a => ({ ...a, resolvedName: a.band_name, resolvedImageUrl: '', lastReleaseId: '0' }))

      // Phase 2: fetch each artist page to resolve proper name, image, and last release
      let fetched = 0
      const setFetchProgress = (): void => {
        loadingEl.textContent = strings.t('artistWatch.onboardingFetching', [String(fetched), String(ranked.length)])
      }
      setFetchProgress()

      for (let i = 0; i < ranked.length; i += RELEASE_FETCH_CONCURRENCY) {
        const batch = ranked.slice(i, i + RELEASE_FETCH_CONCURRENCY)
        await Promise.all(batch.map(async (artist, batchIdx) => {
          const idx = i + batchIdx
          const musicUrl = artist.band_url.replace(/\/?$/, '/music')
          const page = await fetchDocument(musicUrl)
          if (page) {
            resolved[idx].resolvedName = page.querySelector('#band-name-location .title')?.textContent?.trim()
              ?? page.querySelector('#band-name-location h2')?.textContent?.trim()
              ?? artist.band_name
            resolved[idx].resolvedImageUrl = page.querySelector('.artists-bio-pic .popupImage img.band-photo')?.getAttribute('src')
              ?? page.querySelector('.artists-bio-pic img.band-photo')?.getAttribute('src')
              ?? ''
            resolved[idx].lastReleaseId = page.querySelector('#music-grid li:first-child')?.getAttribute('data-item-id') ?? '0'
          }
          fetched++
          setFetchProgress()
        }))
      }

      await this.saveToStorage<OnboardingLock | null>(StorageKeys.onboardingLock, null)
      await this.saveToStorage(StorageKeys.onboardingCache, { timestamp: Date.now(), resolved })
    }

    // Phase 3: render list from resolved data
    const listHtml = resolved.map((artist, i) => `
      <li class="bcd-onboarding-item">
        <label>
          <input type="checkbox" name="bcd-onboard-artist" value="${i}">
          ${artist.resolvedImageUrl ? `<img src="${artist.resolvedImageUrl}" alt="" class="bcd-onboarding-avatar" loading="lazy">` : '<span class="bcd-onboarding-avatar"></span>'}
          <span class="bcd-onboarding-name">${escapeHtml(artist.resolvedName)}</span>
          <span class="bcd-onboarding-count">${strings.tp('artistWatch.onboardingItemCount', artist.count)}</span>
        </label>
      </li>
    `).join('')

    container.innerHTML = `
      <h3 class="bcd-onboarding-title">${strings.t('artistWatch.onboardingTitle')}</h3>
      <p class="bcd-onboarding-description">${strings.t('artistWatch.onboardingDescription')}</p>
      <ul class="bcd-onboarding-list">${listHtml}</ul>
      <div class="bcd-onboarding-actions">
        <button type="button" class="bcd-onboarding-btn-selected"></button>
        <button type="button" class="bcd-onboarding-btn-all">${strings.t('artistWatch.onboardingWatchAll', [String(resolved.length)])}</button>
      </div>
    `

    const btnSelected = container.querySelector<HTMLButtonElement>('.bcd-onboarding-btn-selected')!
    const updateSelectedCount = (): void => {
      const count = container.querySelectorAll<HTMLInputElement>('input[name="bcd-onboard-artist"]:checked').length
      btnSelected.textContent = strings.t('artistWatch.onboardingWatchSelected', [String(count)])
    }
    container.querySelector('.bcd-onboarding-list')?.addEventListener('change', updateSelectedCount)
    updateSelectedCount()

    const watchArtists = async (artists: ResolvedArtist[]): Promise<void> => {
      const now = Date.now()

      for (const artist of artists) {
        const key = toKey(artist.band_id)
        if (!this.watchedArtists[key]) {
          this.watchedArtists[key] = {
            bandId: artist.band_id,
            bandName: artist.resolvedName,
            bandUrl: artist.band_url,
            imageUrl: artist.resolvedImageUrl,
            lastTimeChecked: now,
            lastReleaseChecked: artist.lastReleaseId,
          }
        }
      }

      await this.saveWatchedArtists()
      container.remove()
      await this.addFetcherButton(tabId)
      this.addSummaryWatchedArtists()
    }

    btnSelected.addEventListener('click', () => {
      const checked = Array.from(container.querySelectorAll<HTMLInputElement>('input[name="bcd-onboard-artist"]:checked'))
        .map(input => resolved[Number(input.value)])
        .filter((a): a is ResolvedArtist => a !== undefined)

      void watchArtists(checked).catch(err => console.error('[BCD] watchArtists failed:', err))
    })

    container.querySelector('.bcd-onboarding-btn-all')?.addEventListener('click', () => {
      void watchArtists(resolved).catch(err => console.error('[BCD] watchArtists failed:', err))
    })
  }

  private addSummaryWatchedArtists(): void {
    if (
      this.tabReleaseContent === null
      || Object.keys(this.watchedArtists).length === 0
    ) {
      return
    }

    const summaryContainerClass = 'bcd-watched-artists-summary'
    if (this.tabReleaseContent.querySelector(`.${summaryContainerClass}`)) {
      return
    }

    const artistListItems = Object.values(this.watchedArtists)
      .map(artist => `
        <li>
          <a href="${safeUrl(artist.bandUrl)}" target="_blank" rel="noopener noreferrer">
            ${escapeHtml(artist.bandName)}
          </a>
        </li>
      `)
      .join('')

    const summaryContainer = document.createElement('div')
    summaryContainer.className = summaryContainerClass
    summaryContainer.innerHTML = `
      <h3>${strings.t('artistWatch.watchedArtists')}</h3>
      <ul class="bcd-watched-artists-list">${artistListItems}</ul>
    `
    this.tabReleaseContent.appendChild(summaryContainer)
  }

  private addArtistWatchToggle(): void {
    const currentBlob = this.bandcampDomHandler.getCurrentBlob()
    const bandId = document.querySelector('#contact-tracker-data')?.getAttribute('data-band-id')

    if (!bandId) {
      return
    }

    const formattedBandId = Number(bandId)
    const isWatched = this.watchedArtists[toKey(formattedBandId)] !== undefined
    if (isWatched) {
      if (this.bandcampDomHandler.isArtistPage()) {
        const latestReleaseId = document.querySelector('#music-grid li:first-child')?.getAttribute('data-item-id') ?? undefined
        this.updateDateCheckedForWatchedArtists(formattedBandId, latestReleaseId)
      }
      else if (this.bandcampDomHandler.isAlbumPage()) {
        const hasBuyFullDiscography = this.bandcampDomHandler.currentBlob?.show_buy_full_disco
        if (hasBuyFullDiscography) {
          const firstRelease = this.bandcampDomHandler.currentBlob?.buyfulldisco?.tralbums?.[0]
          const latestReleaseId = firstRelease ? `album-${firstRelease.item_id}` : undefined
          this.updateDateCheckedForWatchedArtists(formattedBandId, latestReleaseId)
        }
        else {
          // No discography data available on this page — fetch the artist page to get the latest release
          fetchDocument(parseArtistUrl(window.location.origin)).then((artistPage) => {
            const latestReleaseId = artistPage
              ? artistPage.querySelector('#music-grid li:first-child')?.getAttribute('data-item-id') ?? undefined
              : undefined
            this.updateDateCheckedForWatchedArtists(formattedBandId, latestReleaseId)
          })
        }
      }
      else {
        this.updateDateCheckedForWatchedArtists(formattedBandId)
      }
    }

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'bcd-label-watch-toggle'
    this.updateArtistWatchButton(button, isWatched)

    // Find a good place to insert the button
    const followingActionsWrapper = document.querySelector('.following-actions-wrapper')
    followingActionsWrapper?.appendChild(button)

    button.addEventListener('click', async () => {
      const currentlyWatched = this.watchedArtists[toKey(formattedBandId)] !== undefined

      if (!currentlyWatched) {
        let lastReleaseId: string = '0'

        if (this.bandcampDomHandler.isArtistPage()) {
          lastReleaseId = String(document.querySelector('#music-grid li:first-child')?.getAttribute('data-item-id')) || '0'
        }
        else if (this.bandcampDomHandler.isAlbumPage()) {
          const hasBuyFullDiscography = this.bandcampDomHandler.currentBlob?.show_buy_full_disco
          if (hasBuyFullDiscography) {
            // Get the first release of buyfulldisco
            const firstReleaseDiscography = this.bandcampDomHandler.currentBlob?.buyfulldisco?.tralbums?.[0]
            lastReleaseId = firstReleaseDiscography ? `album-${firstReleaseDiscography.item_id}` : '0'
          }
          else {
            const artistPage = await fetchDocument(parseArtistUrl(window.location.origin))
            lastReleaseId = artistPage
              ? String(artistPage.querySelector('#music-grid li:first-child')?.getAttribute('data-item-id')) || '0'
              : '0'
          }
        }

        const parsedUrl = parseArtistUrl(window.location.origin)

        // Add label to watch list
        const artistData: ArtistWatchData = {
          bandId: formattedBandId,
          bandName: currentBlob?.band?.name || document.querySelector('#band-name-location .title')?.textContent?.trim() || '',
          bandUrl: parsedUrl,
          imageUrl: (document.querySelector('.artists-bio-pic img.band-photo') as HTMLImageElement)?.src || '',
          lastTimeChecked: Date.now(),
          lastReleaseChecked: lastReleaseId || '0',
        }

        this.watchedArtists[toKey(formattedBandId)] = artistData
      }
      else {
        // Remove from watch list
        delete this.watchedArtists[toKey(formattedBandId)]
      }

      await this.saveWatchedArtists()
      this.updateArtistWatchButton(button, !currentlyWatched)
    })
  }

  private async updateDateCheckedForWatchedArtists(bandId: number, latestReleaseId?: string): Promise<void> {
    const artistKey = toKey(bandId)
    if (this.watchedArtists[artistKey]) {
      this.watchedArtists[artistKey].lastTimeChecked = Date.now()
      if (latestReleaseId) {
        this.watchedArtists[artistKey].lastReleaseChecked = latestReleaseId
      }
      await this.saveWatchedArtists()
    }
  }

  private updateArtistWatchButton(button: HTMLButtonElement, isWatched: boolean): void {
    const ariaLabel = isWatched
      ? strings.t('artistWatch.stopWatching')
      : strings.t('artistWatch.watchReleases')
    const label = `<span>${ariaLabel}</span>`

    button.innerHTML = isWatched ? `${icon('eyeOff')}${label}` : `${icon('eye')}${label}`
    button.title = ariaLabel
    button.setAttribute('aria-label', ariaLabel)
    button.classList.toggle('watched', isWatched)
  }

  private async fetchNewReleasesForArtist(artistData: ArtistWatchData): Promise<{ urls: string[], firstReleaseId: string | null }> {
    const artistPage = await fetchDocument(artistData.bandUrl)
    const noResultReturn = { urls: [], firstReleaseId: null }
    if (!artistPage) {
      return noResultReturn
    }

    const gridMusic = artistPage.querySelector('#music-grid')
    if (!gridMusic) {
      return noResultReturn
    }

    const releases = Array.from(gridMusic.querySelectorAll('li[data-item-id]'))
    const urls: string[] = []

    for (const release of releases) {
      const itemId = release.getAttribute('data-item-id') || '0'

      if (itemId === artistData.lastReleaseChecked) {
        break
      }

      const url = release.querySelector('a')?.getAttribute('href') || ''
      if (url) {
        const formattedUrl = url.startsWith('http')
          ? url
          : new URL(url, `${artistData.bandUrl}/`).href

        urls.push(formattedUrl)
      }
    }

    const firstReleaseId = releases[0]?.getAttribute('data-item-id') || null

    return { urls, firstReleaseId }
  }

  private async processRelease(releaseUrl: string, lastTimeChecked: number): Promise<{ status: 'added' } & FoundRelease | { status: 'skipped' | 'error' }> {
    const releasePage = await fetchDocument(releaseUrl)
    if (!releasePage) {
      return { status: 'error' }
    }

    let ldJson = null
    let blob = null

    const ldJsonScript = releasePage.querySelector('script[type="application/ld+json"]')

    if (ldJsonScript) {
      try {
        ldJson = JSON.parse(ldJsonScript.textContent || '{}')
      }
      catch (error) {
        console.error('Failed to parse ld+json for release at', releaseUrl, error)
        return { status: 'error' }
      }
    }

    const blobData = releasePage.querySelector('#pagedata')?.getAttribute('data-blob')
    if (blobData) {
      try {
        blob = JSON.parse(blobData)
      }
      catch (error) {
        console.error('Failed to parse blob data for release at', releaseUrl, error)
        return { status: 'error' }
      }
    }

    if (blob === null && ldJson === null) {
      return { status: 'error' }
    }

    // Check if release date qualifies for adding
    const currentDate = Date.now()
    const releaseDate = new Date(ldJson.datePublished).getTime()
    const isUpcoming = releaseDate > currentDate
    const isMissedRelease = lastTimeChecked > 0 && releaseDate > lastTimeChecked && releaseDate <= currentDate

    if (!isUpcoming && !isMissedRelease) {
      return { status: 'skipped' }
    }

    this.dispatchEvent(EVENTS.newReleases.addRelease, { blob, ldJson, lastTimeChecked })
    return {
      status: 'added',
      title: ldJson.name || '',
      artist: ldJson.byArtist?.name || '',
      url: ldJson['@id'] || releaseUrl,
    }
  }

  public async scanAllWatchedArtists(): Promise<void> {
    const artistIds = Object.keys(this.watchedArtists)

    if (artistIds.length === 0) {
      return
    }

    this.bandcampDomHandler.showProgressDialog({
      title: strings.t('artistWatch.scanningTitle'),
      current: 0,
      total: artistIds.length,
      showCancel: false,
    })

    let processedArtists = 0
    const foundReleases: FoundRelease[] = []

    for (let i = 0; i < artistIds.length; i += ARTIST_FETCH_CONCURRENCY) {
      const batch = artistIds.slice(i, i + ARTIST_FETCH_CONCURRENCY)

      const batchNames = batch.map(k => this.watchedArtists[k].bandName).join(', ')
      this.bandcampDomHandler.updateProgressDialog({
        current: processedArtists,
        total: artistIds.length,
        description: strings.t('artistWatch.fetchingBatch', [batchNames]),
      })

      const batchResults = await Promise.all(
        batch.map(async (artistIdKey) => {
          const artistData = this.watchedArtists[artistIdKey]
          const { urls, firstReleaseId } = await this.fetchNewReleasesForArtist(artistData)

          return { artistIdKey, artistData, urls, firstReleaseId }
        }),
      )

      for (const { artistIdKey, artistData, urls, firstReleaseId } of batchResults) {
        if (urls.length > 0) {
          const reversed = urls.reverse()

          for (let j = 0; j < reversed.length; j += RELEASE_FETCH_CONCURRENCY) {
            const relBatch = reversed.slice(j, j + RELEASE_FETCH_CONCURRENCY)

            this.bandcampDomHandler.updateProgressDialog({
              current: processedArtists + 1,
              total: artistIds.length,
              description: strings.t('artistWatch.processingReleases', [artistData.bandName, String(j + 1), String(Math.min(j + relBatch.length, reversed.length)), String(reversed.length)]),
            })

            const results = await Promise.all(
              relBatch.map(url => this.processRelease(url, artistData.lastTimeChecked)),
            )
            for (const result of results) {
              if (result.status === 'added') {
                foundReleases.push({ title: result.title, artist: result.artist, url: result.url })
              }
            }

            if (j + RELEASE_FETCH_CONCURRENCY < reversed.length) {
              await new Promise(resolve => setTimeout(resolve, RELEASE_FETCH_DELAY_MS))
            }
          }

          if (firstReleaseId) {
            this.watchedArtists[artistIdKey].lastReleaseChecked = firstReleaseId
            await this.saveWatchedArtists()
          }
        }

        this.bandcampDomHandler.updateProgressDialog({
          current: ++processedArtists,
          total: artistIds.length,
          description: strings.t('artistWatch.scannedArtist', [artistData.bandName, String(processedArtists), String(artistIds.length)]),
        })
      }

      if (i + ARTIST_FETCH_CONCURRENCY < artistIds.length) {
        await new Promise(resolve => setTimeout(resolve, ARTIST_SCAN_DELAY_MS))
      }
    }

    this.bandcampDomHandler.showProgressSummary({
      title: strings.t('artistWatch.scanCompleteTitle'),
      summary: [
        strings.tp('artistWatch.scannedCount', artistIds.length),
        strings.t('artistWatch.addedCount', [String(foundReleases.length)]),
      ],
      foundReleases,
    })
    await this.saveToStorage(StorageKeys.lastArtistScan, Date.now())
    await this.saveWatchedArtists()
    if (foundReleases.length > 0) {
      this.dispatchEvent(EVENTS.newReleases.refresh, {})
    }
  }
}
