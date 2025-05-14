import type { CollectionTrackItem, ItemData, ItemStatus, LoosePageBlob, NewReleaseData, PlaylistData, ProgressDialogUpdateOptions, ProgressSummaryOptions, ReleaseLdJson, StatisticsRenderArgs, TabData, TracklistEntry, WindowBandcampData } from '../shared/types'
import { GRID_MUTATION_DEBOUNCE_MS } from '../shared/constants'
import { EVENTS } from '../shared/events'
import * as pageDetection from '../shared/pageDetection'
import { strings } from '../shared/strings'
import { dispatchCustomEvent, formatLocalDate, isFirefox, onCustomEvent } from '../shared/utils'
import { icon } from '../ui/icons'
import { PlaylistDomService } from '../ui/playlistDom'
import { ProgressDialog } from '../ui/progressDialog'
import { generateSummaryOfUpcomingReleases, generateTrackListItem } from '../ui/trackListRenderer'
import '../assets/css/content.scss'

export class BandcampDomHandler {
  public currentBlob: LoosePageBlob | null = null
  public currentApplicationLdJson: ReleaseLdJson | null = null
  public windowBandcampData: WindowBandcampData | null = null

  private progress = new ProgressDialog()
  private playlistDom: PlaylistDomService
  private tracksScriptInjected = false
  private started = false
  private gridObservers: MutationObserver[] = []

  constructor() {
    this.playlistDom = new PlaylistDomService(
      (itemId?: number) => this.gatherTrackInfo(itemId),
    )

    if (this.isUserConnected() === false) {
      return
    }

    if (this.isRelevantPage() === false) {
      return
    }

    this.currentBlob = this.getCurrentBlob()

    if (this.isPageWithInteraction() === false) {
      return
    }

    this.currentApplicationLdJson = this.getCurrentApplicationLdJson()

    this.retrieveTracksScript()

    onCustomEvent<WindowBandcampData>(EVENTS.dom.retrieveTracks, (detail) => {
      this.windowBandcampData = detail
    })

    window.addEventListener('click', (event: MouseEvent) => {
      const target = event.target as HTMLElement

      const clickedPlay = target.closest('.track_play_auxiliary') as HTMLElement
      if (clickedPlay) {
        const clickedItem = target.closest('.bcd-item') as HTMLElement
        const itemId = clickedItem.dataset.itemid
        if (!itemId) {
          return
        }

        const streamingData = clickedItem.getAttribute('data-streaming')
        if (streamingData) {
          try {
            const streamDataObj = JSON.parse(streamingData)
            dispatchCustomEvent(EVENTS.dom.playerInteract, streamDataObj)
          }
          catch (err) {
            console.error('Failed to parse data-streaming:', err)
          }
        }
      }
    })
  }

  start(): void {
    if (this.started) {
      return
    }
    this.started = true

    onCustomEvent(EVENTS.dom.gridUpdate, () => {
      const containers: [string, string][] = [
        ['#collection-items', '.collection-item-container'],
        ['#wishlist-grid', '.collection-item-container'],
        ['#new-releases-grid .collection-grid', '.collection-item-container'],
        ['#collection-search-grid', '.collection-item-container'],
        ['#wishlist-search-grid', '.collection-item-container'],
      ]

      const gridItems = containers.flatMap(([containerSel, itemSel]) => {
        const container = document.querySelector(containerSel)

        return container ? Array.from(container.querySelectorAll(itemSel)) : []
      }).filter(item => !item.hasAttribute('data-bcd-checked'))

      const proccessEvents = [
        EVENTS.newReleases.processItem,
        EVENTS.playlists.processItem,
      ]

      gridItems.forEach((item) => {
        proccessEvents.forEach((eventName) => {
          dispatchCustomEvent(eventName, { item })
        })

        item.setAttribute('data-bcd-checked', 'true')
      })
    })

    if (this.isOwnAccountPage()) {
      if (!isFirefox()) {
        const popupButton = document.createElement('button')
        popupButton.id = 'bcd-open-popup-button'
        popupButton.innerHTML = `${icon('cog')} ${strings.t('popup.settingsButton')}`
        popupButton.addEventListener('click', () => {
          browser.runtime.sendMessage({ action: 'openPopup' })
        })

        const openWrapper = document.querySelector('.fan-bio-wrapper')
        if (openWrapper) {
          openWrapper.appendChild(popupButton)
        }
      }

      const grids = document.querySelectorAll('.collection-grid')
      if (grids.length) {
        const eventName = EVENTS.dom.gridUpdate

        dispatchCustomEvent(eventName)

        grids.forEach((grid) => {
          let childCount = grid.children.length
          let debounceTimer: ReturnType<typeof setTimeout> | undefined

          const observer = new MutationObserver(() => {
            clearTimeout(debounceTimer)

            debounceTimer = setTimeout(() => {
              const currentCount = grid.children.length
              if (currentCount !== childCount) {
                childCount = currentCount
                dispatchCustomEvent(eventName)
                this.retrieveTracksScript()
              }
            }, GRID_MUTATION_DEBOUNCE_MS)
          })

          observer.observe(grid, { childList: true })
          this.gridObservers.push(observer)
        })
      }
    }
  }

  // --- Page detection ---

  isUserConnected(): boolean {
    return pageDetection.isUserConnected()
  }

  isDownloadPage(): boolean {
    return pageDetection.isDownloadPage()
  }

  isOwnAccountPage(): boolean {
    return this.currentBlob?.fan_data?.is_own_page === true
  }

  isAccountPage(): boolean {
    return pageDetection.isAccountPage()
  }

  isAlbumPage(): boolean {
    return pageDetection.isAlbumPage()
  }

  isRelevantPage(): boolean {
    return pageDetection.isRelevantPage()
  }

  isArtistPage(): boolean {
    return pageDetection.isArtistPage()
  }

  isPageWithInteraction(): boolean {
    return this.isOwnAccountPage() || this.isAlbumPage()
  }

  // --- Tab management ---

  addTabToProfile(tabData: TabData): HTMLElement | null {
    const gridsContainer = document.getElementById('grids')
    if (!gridsContainer) {
      return null
    }

    const addedGrid = document.createElement('div')
    addedGrid.id = `${tabData.tabId}-grid`
    addedGrid.className = 'grid'

    const addedContainer = document.createElement('div')
    addedContainer.id = `${tabData.tabId}-container`
    addedContainer.className = `inner`

    addedGrid.appendChild(addedContainer)
    gridsContainer.appendChild(addedGrid)

    const tabsContainer = document.getElementById('grid-tabs')
    if (tabsContainer) {
      const addedTab = document.createElement('li')
      addedTab.setAttribute('data-tab', tabData.tabId)
      addedTab.setAttribute('data-grid-id', `${tabData.tabId}-grid`)
      addedTab.className = ''

      const tabTitle = document.createElement('span')
      tabTitle.className = 'tab-title'
      tabTitle.textContent = `${tabData.title} `

      const countSpan = document.createElement('span')
      countSpan.className = 'count'
      countSpan.textContent = `${tabData.count}`

      tabTitle.appendChild(countSpan)
      addedTab.appendChild(tabTitle)
      tabsContainer.appendChild(addedTab)

      addedTab.addEventListener('click', () => {
        const tabs = tabsContainer.querySelectorAll('li')
        tabs.forEach(tab => tab.classList.remove('active'))
        addedTab.classList.add('active')

        const grids = gridsContainer.querySelectorAll('.grid')
        grids.forEach((grid) => {
          if (grid.id === `${tabData.tabId}-grid`) {
            grid.classList.add('active')
          }
          else {
            grid.classList.remove('active')
          }
        })

        const elementsToHide = [
          document.getElementById('owner-controls'),
          document.getElementById('wishlist-controls'),
        ]

        for (const elem of elementsToHide) {
          if (elem) {
            elem.style.display = 'none'
          }
        }
      })
    }

    return addedContainer
  }

  // --- Track list rendering (delegated) ---

  generateTrackListItem(data: ItemData, context: 'playlist' | 'new-releases'): HTMLElement {
    return generateTrackListItem(data, context)
  }

  public generateSummaryOfUpcomingReleases(upcomingReleases: NewReleaseData[]): HTMLElement {
    return generateSummaryOfUpcomingReleases(upcomingReleases)
  }

  // --- Page data extraction ---

  getCurrentBlob(): LoosePageBlob {
    const pagedataElement = document.getElementById('pagedata')
    if (pagedataElement && pagedataElement.dataset.blob) {
      try {
        return JSON.parse(pagedataElement.dataset.blob)
      }
      catch (error) {
        console.error('Error parsing pagedata blob:', error)
      }
    }
    return {}
  }

  getCurrentApplicationLdJson(): ReleaseLdJson | null {
    const ldJsonElement = document.querySelector('script[type="application/ld+json"]')
    if (ldJsonElement) {
      try {
        return JSON.parse(ldJsonElement.textContent || 'null')
      }
      catch (error) {
        console.error('Error parsing application/ld+json:', error)
      }
    }
    return null
  }

  // --- Watch button UI ---

  public updateWatchButton(button: HTMLButtonElement, isWatched: boolean, content: string = 'full'): void {
    const ariaLabel = isWatched
      ? strings.t('newReleases.removeFromWatch')
      : strings.t('newReleases.addToWatch')
    const label = content === 'full' ? `<span>${ariaLabel}</span>` : ''
    button.innerHTML = isWatched
      ? `${icon('eyeOff')}${label}`
      : `${icon('eye')}${label}`

    button.title = ariaLabel
    button.setAttribute('aria-label', ariaLabel)
    button.classList.toggle('watched', isWatched)
  }

  public releaseChangedDateWarning(container: HTMLElement, oldReleaseDate: string, newReleaseDate: string): void {
    if (!container) {
      return
    }
    const warningDiv = document.createElement('div')
    warningDiv.className = 'bcd-release-date-change-warning'
    const para = document.createElement('p')
    para.textContent = strings.t('newReleases.releaseDateChanged', [oldReleaseDate, newReleaseDate])
    warningDiv.appendChild(para)
    container.appendChild(warningDiv)
  }

  // --- Playlist DOM (delegated) ---

  public playlistInterface(userPlaylists: PlaylistData[], playlistContainer: HTMLElement | null): void {
    this.playlistDom.playlistInterface(userPlaylists, playlistContainer)
  }

  public displayPlaylistsList(playlists: PlaylistData[], container: HTMLElement): void {
    this.playlistDom.displayPlaylistsList(playlists, container)
  }

  displayPlaylistInterfaceInAlbumPage(userPlaylists: PlaylistData[]): void {
    this.playlistDom.displayPlaylistInterfaceInAlbumPage(userPlaylists, this.currentBlob ?? null)
  }

  public attachPlaylistSelector(item: HTMLElement, userPlaylists: PlaylistData[]): void {
    this.playlistDom.attachPlaylistSelector(item, userPlaylists)
  }

  // --- Track info gathering ---

  public gatherTrackInfo(needleItemId?: number): ItemData {
    let itemStatus: ItemStatus = 'none'

    if (this.isAlbumPage()) {
      if (this.currentBlob && this.currentApplicationLdJson) {
        if (this.currentBlob?.fan_tralbum_data?.is_purchased) {
          itemStatus = 'owned'
        }
        else if (this.currentBlob?.fan_tralbum_data?.is_wishlisted) {
          itemStatus = 'wishlisted'
        }

        let bcStreamData: TracklistEntry | Record<string, never> = {}
        if (this.windowBandcampData?.type === 'tralbum' && this.windowBandcampData.data.length > 0) {
          const trackInfo = this.windowBandcampData.data[0]
          bcStreamData = {
            id: trackInfo.id,
            title: trackInfo.title,
            track_number: trackInfo.track_num,
            duration: trackInfo.duration,
            file: trackInfo.file || {},
          }
        }

        return {
          itemId: Number(this.currentBlob?.track_id) || Number(this.currentBlob?.album_id) || 0,
          typeItem: String(this.currentApplicationLdJson['@type']) === 'MusicAlbum' ? 'a' : 't',
          title: this.currentApplicationLdJson.name || '',
          artist: this.currentApplicationLdJson.byArtist?.name ?? '',
          bandId: Number(this.currentBlob?.fan_tralbum_data?.band_id) || 0,
          albumUrl: this.currentApplicationLdJson['@id'] || '',
          imageUrl: this.currentApplicationLdJson.image ?? '',
          bcStreamData,
          addedAt: Date.now(),
          itemStatus,
        }
      }
    }
    else if (this.isOwnAccountPage()) {
      const trackItem = document.querySelector(`[data-itemid="${needleItemId}"]`) as HTMLElement
      const itemId = trackItem?.getAttribute('data-itemid') || ''

      if (this.windowBandcampData?.type === 'collection') {
        const tracklists = this.windowBandcampData.data

        let itemData: CollectionTrackItem | undefined
        if (tracklists.wishlist && (tracklists.wishlist[`a${itemId}`] || tracklists.wishlist[`t${itemId}`])) {
          const wishlistData = tracklists.wishlist[`a${itemId}`] || tracklists.wishlist[`t${itemId}`]
          itemData = wishlistData[0]
          itemStatus = 'wishlisted'
        }
        else if (tracklists.collection && (tracklists.collection[`a${itemId}`] || tracklists.collection[`t${itemId}`])) {
          const collectionData = tracklists.collection[`a${itemId}`] || tracklists.collection[`t${itemId}`]
          itemData = collectionData[0]
          itemStatus = 'owned'
        }

        if (itemData) {
          const resolvedItemId = itemData.tralbumType === 'a' ? itemData.tralbumId : itemData.trackData.id

          return {
            itemId: resolvedItemId || 0,
            typeItem: itemData.tralbumType,
            bandId: itemData.bandId || 0,
            title: itemData.title || '',
            artist: itemData.artist || '',
            albumUrl: itemData.tralbumBuyUrl || '',
            imageUrl: itemData.artURL || '',
            bcStreamData: itemData.trackData || {},
            addedAt: Date.now(),
            itemStatus,
          }
        }
      }

      if (trackItem && trackItem.getAttribute('data-itemid')) {
        const collectionItemsElement = trackItem.closest('.collection-items')
        if (collectionItemsElement) {
          if (collectionItemsElement.id === 'wishlist-grid') {
            itemStatus = 'wishlisted'
          }
          else if (collectionItemsElement.id === 'collection-grid') {
            itemStatus = 'owned'
          }
        }

        return {
          itemId: Number(trackItem.getAttribute('data-itemid')) || 0,
          typeItem: String(trackItem.getAttribute('data-tralbumtype')) === 'a' ? 'a' : 't',
          bandId: Number.parseInt(trackItem.getAttribute('data-bandid') || '0', 10),
          title: trackItem.getAttribute('data-title') || '',
          artist: trackItem.querySelector('.collection-item-artist')?.textContent?.trim() || '',
          albumUrl: trackItem.querySelector('.collection-title-details a')?.getAttribute('href') || '',
          imageUrl: trackItem.querySelector('img.collection-item-art')?.getAttribute('src') || '',
          bcStreamData: {},
          addedAt: Date.now(),
          itemStatus,
        }
      }
    }

    return {
      itemId: 0,
      typeItem: 't',
      title: '',
      artist: '',
      bandId: 0,
      albumUrl: '',
      imageUrl: '',
      bcStreamData: {},
      addedAt: Date.now(),
      itemStatus,
    }
  }

  // --- Stats rendering ---

  public renderUserStats(renderArgs: StatisticsRenderArgs): void {
    const hasStats = Object.values(renderArgs.evolution).some(value => Number(value) > 0)

    if (hasStats === false) {
      return
    }

    const statsContainer = document.querySelector('.fan-bio-inner .info-items')
    if (!statsContainer) {
      return
    }

    let statsElement = statsContainer.querySelector('.bcd-user-stats')
    if (!statsElement) {
      statsElement = document.createElement('div')
      statsElement.className = 'bcd-user-stats'
      statsContainer.appendChild(statsElement)
    }

    let labelText = strings.t('stats.evolutionTitle')

    switch (renderArgs.statisticsType) {
      case 'since': {
        const now = new Date()
        let pastDate = new Date()
        if (renderArgs.lastRecordDate) {
          const parsed = new Date(renderArgs.lastRecordDate)
          if (!Number.isNaN(parsed.getTime())) {
            pastDate = parsed
          }
          else {
            console.warn('Invalid lastRecordDate provided:', renderArgs.lastRecordDate)
          }
        }

        labelText += strings.t('stats.since', [formatLocalDate(pastDate)])

        const diffTime = Math.abs(now.getTime() - pastDate.getTime())
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        labelText += strings.t('stats.days', [String(diffDays)])
        break
      }
      case 'last':
        labelText += strings.t('stats.lastWeek')
        break
      default:
        labelText = ''
    }
    const fields = [
      { key: 'views', label: strings.t('stats.views'), value: Number(renderArgs.evolution.views || 0) },
      { key: 'timesPlayed', label: strings.t('stats.timesPlayed'), value: Number(renderArgs.evolution.timesPlayed || 0) },
      { key: 'followers', label: strings.t('stats.followers'), value: Number(renderArgs.evolution.followers || 0) },
    ]

    const fieldHtml = fields
      .filter(f => f.value !== 0)
      .map(f => `
      <div class="stat-item" data-stat="${f.key}">
        <span class="stat-label">${f.label}:</span>
        <span class="stat-value">${f.value}</span>
      </div>
      `)
      .join('')

    statsElement.innerHTML = `<div class="stat-label">${labelText}</div>${fieldHtml}`
  }

  // --- Progress dialog (delegated) ---

  public showProgressDialog(options: {
    title: string
    current?: number
    total?: number
    showCancel?: boolean
    onCancel?: () => void
  }): void {
    this.progress.show(options)
  }

  public updateProgressDialog(options: ProgressDialogUpdateOptions): void {
    this.progress.update(options)
  }

  public hideProgressDialog(): void {
    this.progress.hide()
  }

  public isProgressCancelled(): boolean {
    return this.progress.isCancelled()
  }

  public showProgressSummary(options: ProgressSummaryOptions): void {
    this.progress.showSummary(options)
  }

  // --- Script injection ---

  public retrieveTracksScript(): void {
    if (!this.tracksScriptInjected) {
      this.tracksScriptInjected = true
      const script = document.createElement('script')
      script.src = browser.runtime.getURL('/retrieve-tracks.js')
      script.onload = (): void => {
        script.remove()
        this.tracksScriptInjected = false
      }
      document.documentElement.appendChild(script)
    }

    if (this.isOwnAccountPage() && !document.getElementById('bcd-player-interact-script')) {
      const playerInteractScript = document.createElement('script')
      playerInteractScript.id = 'bcd-player-interact-script'
      playerInteractScript.src = browser.runtime.getURL('/player-interact.js')
      document.documentElement.appendChild(playerInteractScript)
    }
  }
}
