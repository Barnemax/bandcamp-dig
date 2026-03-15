import type { LoosePageBlob, NewReleaseData, ReleaseLdJson, TabData } from '../shared/types'
import { EVENTS } from '../shared/events'
import { StorageKeys } from '../shared/storageKeys'
import { strings } from '../shared/strings'
import { formatLocalDate } from '../shared/utils'
import { toKey } from '../storage/storageCodec'
import { BaseHandler } from './baseHandler'

export class NewReleaseHandler extends BaseHandler {
  public watchedReleases: Record<string, NewReleaseData> = {}
  private loadedReleasesRevision: number = 0
  private historyOfReleasedDate: Record<number, number> = {}
  private newReleasesContainer: HTMLElement | null = null

  public hasLoadingConditions(): boolean {
    return this.bandcampDomHandler.isOwnAccountPage() || this.bandcampDomHandler.isAlbumPage()
  }

  protected setupEventListeners(): void {
    // Allow to add release from other parts of the extension
    // Note: Callers should pre-filter releases (e.g., artistWatchHandler.processRelease checks dates before dispatching)
    this.onEvent<{ blob: LoosePageBlob, ldJson: ReleaseLdJson }>(EVENTS.newReleases.addRelease, async (detail) => {
      if (!detail.blob || !detail.ldJson) {
        return
      }
      const newReleaseData = this.buildReleaseFromLdJson(detail.blob, detail.ldJson)
      if (this.watchedReleases[toKey(newReleaseData.itemId)]) {
        return
      }
      await this.mutateAndSaveReleases((releases) => {
        if (!releases[toKey(newReleaseData.itemId)]) {
          releases[toKey(newReleaseData.itemId)] = newReleaseData
        }
      })
    })

    this.onEvent(EVENTS.newReleases.loaded, async () => {
      if (this.bandcampDomHandler.isAlbumPage()) {
        this.addNewReleaseToggleToAlbumPage()
      }

      if (this.bandcampDomHandler.isOwnAccountPage()) {
        const { released: releasedWatchedReleases, upcoming: upcomingWatchedReleases } = this.splitWatchedReleases()
        const newReleaseArgs: TabData = {
          tabId: 'new-releases',
          title: strings.t('newReleases.tabTitle'),
          count: releasedWatchedReleases.length,
        }

        const newReleases = this.bandcampDomHandler.addTabToProfile(newReleaseArgs)
        this.newReleasesContainer = newReleases

        if (newReleases) {
          const trackGrid = document.createElement('ol')
          trackGrid.className = 'collection-grid'

          releasedWatchedReleases.forEach((release) => {
            const trackElement = this.bandcampDomHandler.generateTrackListItem(release, 'new-releases')
            if (trackElement) {
              trackGrid.appendChild(trackElement)
            }
          })

          newReleases.appendChild(trackGrid)
          this.dispatchEvent(EVENTS.dom.gridUpdate)
        }

        // Add a table summary for future releases in the same tab
        if (upcomingWatchedReleases.length > 0) {
          // Sort by release date ascending
          upcomingWatchedReleases.sort((a, b) => (a.releaseDate || 0) - (b.releaseDate || 0))

          const futureReleasesHeader = document.createElement('h3')
          futureReleasesHeader.textContent = strings.t('newReleases.upcomingReleases')
          newReleases?.appendChild(futureReleasesHeader)

          const summaryTable = this.bandcampDomHandler.generateSummaryOfUpcomingReleases(upcomingWatchedReleases)
          if (summaryTable) {
            newReleases?.appendChild(summaryTable)
          }
        }

        // Dispatch event that new releases tab is loaded
        this.dispatchEvent(EVENTS.newReleases.tabLoaded, { tabId: 'new-releases' })
      }
    })

    this.onEvent<{ item: HTMLElement }>(EVENTS.newReleases.processItem, (detail) => {
      this.historyOfReleasedDate = this.processItem(detail.item, this.historyOfReleasedDate)
    })

    this.onEvent(EVENTS.cronTasks.daily, async () => {
      await this.checkForReleasedInWatchedReleases()
    })

    this.onEvent(EVENTS.newReleases.refresh, () => {
      this.refreshGrid()
    })
  }

  private refreshGrid(): void {
    if (!this.newReleasesContainer) {
      return
    }

    const { released: releasedWatchedReleases, upcoming: upcomingWatchedReleases } = this.splitWatchedReleases()

    // Replace the released grid
    this.newReleasesContainer.querySelector('ol.collection-grid')?.remove()
    const trackGrid = document.createElement('ol')
    trackGrid.className = 'collection-grid'
    releasedWatchedReleases.forEach((release) => {
      const trackElement = this.bandcampDomHandler.generateTrackListItem(release, 'new-releases')
      if (trackElement) {
        trackGrid.appendChild(trackElement)
      }
    })
    const summaryEl = this.newReleasesContainer.querySelector('.bcd-watched-artists-summary')
    this.newReleasesContainer.insertBefore(trackGrid, summaryEl ?? null)
    this.dispatchEvent(EVENTS.dom.gridUpdate)

    // Replace the upcoming section (direct-child h3 + summary div)
    this.newReleasesContainer.querySelector(':scope > h3')?.remove()
    this.newReleasesContainer.querySelector('.bcd-upcoming-releases-summary')?.remove()
    if (upcomingWatchedReleases.length > 0) {
      upcomingWatchedReleases.sort((a, b) => (a.releaseDate || 0) - (b.releaseDate || 0))
      const header = document.createElement('h3')
      header.textContent = strings.t('newReleases.upcomingReleases')
      this.newReleasesContainer.insertBefore(header, summaryEl ?? null)
      const summaryTable = this.bandcampDomHandler.generateSummaryOfUpcomingReleases(upcomingWatchedReleases)
      this.newReleasesContainer.insertBefore(summaryTable, summaryEl ?? null)
    }

    // Update tab count
    const countEl = document.querySelector('li[data-tab="new-releases"] .count')
    if (countEl) {
      countEl.textContent = String(releasedWatchedReleases.length)
    }
  }

  private splitWatchedReleases(): { released: NewReleaseData[], upcoming: NewReleaseData[] } {
    const now = Date.now()
    const released: NewReleaseData[] = []
    const upcoming: NewReleaseData[] = []
    for (const release of Object.values(this.watchedReleases)) {
      if (release.isReleased || (release.releaseDate > 0 && release.releaseDate <= now)) {
        released.push(release)
      }
      else {
        upcoming.push(release)
      }
    }
    return { released, upcoming }
  }

  private buildReleaseFromLdJson(blob: LoosePageBlob, ldJson: ReleaseLdJson): NewReleaseData {
    const now = Date.now()
    const releaseDate = ldJson.datePublished ? new Date(ldJson.datePublished).getTime() : 0

    return {
      itemId: blob.track_id || blob.album_id || 0,
      typeItem: String(ldJson['@type']) === 'MusicAlbum' ? 'a' : 't',
      bandId: Number(blob?.fan_tralbum_data?.band_id) || 0,
      title: ldJson.name || '',
      artist: ldJson.byArtist?.name ?? '',
      albumUrl: ldJson['@id'] || '',
      imageUrl: ldJson.image ?? '',
      releaseDate,
      isReleased: releaseDate > 0 && releaseDate <= now,
      bcStreamData: {},
      addedAt: now,
      itemStatus: 'none',
    }
  }

  private buildReleaseFromDomItem(item: HTMLElement, albumIdInt: number, maybeReleaseDate: number): NewReleaseData {
    return {
      itemId: albumIdInt,
      typeItem: String(item.getAttribute('data-tralbumtype')) === 'a' ? 'a' : 't',
      bandId: Number.parseInt(item.getAttribute('data-bandid') || '0', 10),
      title: item.getAttribute('data-title') || '',
      artist: item.querySelector('.collection-item-artist')?.textContent || '',
      albumUrl: item.querySelector('.collection-item-art-container a')?.getAttribute('href') || '',
      imageUrl: item.querySelector('.collection-item-art img')?.getAttribute('src') || '',
      releaseDate: maybeReleaseDate,
      isReleased: false,
      bcStreamData: {},
      addedAt: Date.now(),
      itemStatus: 'none',
    }
  }

  public async getWatchedReleases(): Promise<Record<string, NewReleaseData>> {
    const releases = await this.loadFromStorage<Record<string, NewReleaseData>>(StorageKeys.watchedReleases, {})

    if (!this.validateObjectData<Record<string, NewReleaseData>>(releases, 'Watched releases data is not an object:')) {
      return {}
    }

    return releases
  }

  private async saveWatchedReleases(): Promise<void> {
    await this.saveToStorage(StorageKeys.watchedReleases, this.watchedReleases)
  }

  private async mutateAndSaveReleases(mutate: (data: Record<string, NewReleaseData>) => void): Promise<void> {
    const { isStale, newRevision } = await this.checkRevisionAndBump('watchedReleases', this.loadedReleasesRevision)
    if (isStale) {
      this.watchedReleases = await this.getWatchedReleases()
    }
    mutate(this.watchedReleases)
    this.loadedReleasesRevision = newRevision
    await this.saveWatchedReleases()
  }

  public async initStorageData(): Promise<void> {
    if (this.loadingConditionsMet === false) {
      return
    }
    const [releases, revisions] = await Promise.all([this.getWatchedReleases(), this.loadRevisions()])
    this.watchedReleases = releases
    this.loadedReleasesRevision = revisions.watchedReleases ?? 0
    this.dispatchEvent(EVENTS.newReleases.loaded, { watchedReleases: this.watchedReleases })
  }

  public async checkForReleasedInWatchedReleases(): Promise<void> {
    const now = Date.now()
    await this.mutateAndSaveReleases((releases) => {
      Object.values(releases).forEach((release) => {
        release.isReleased = !!(release.releaseDate && release.releaseDate <= now)
      })
    })
  }

  public async addNewReleaseToggleToAlbumPage(): Promise<void> {
    const currentBlob = this.bandcampDomHandler.currentBlob
    const albumId = currentBlob?.album_id || 0
    let isWatched = this.watchedReleases[toKey(albumId)] !== undefined
    const currentLd = this.bandcampDomHandler.getCurrentApplicationLdJson()
    if (!currentLd) {
      return
    }

    if (currentLd['@type'] !== 'MusicAlbum' && isWatched === false) {
      // Not an album page, do not show the toggle
      return
    }

    const currentReleaseDate = new Date(currentLd.datePublished ?? '').getTime()
    const currentDate = Date.now()

    if (currentReleaseDate <= currentDate && isWatched === false) {
      // Album is already released (and we do not watch it), do not show the toggle
      return
    }

    const shareControls = document.querySelector('.share-collect-controls')
    if (!shareControls) {
      return
    }

    // Check if the release date is in the past
    const releaseDateStocked = new Date(this.watchedReleases[toKey(albumId)]?.releaseDate).getTime() || 0
    // Compare if datePublished is different from the stocked release date
    if (
      releaseDateStocked === currentReleaseDate
      || currentReleaseDate <= currentDate
    ) {
      // Do nothing
    }
    else {
      // Update the release date in the watched releases
      if (isWatched) {
        await this.mutateAndSaveReleases((releases) => {
          releases[toKey(albumId)].releaseDate = currentLd.datePublished ? currentReleaseDate : 0
          releases[toKey(albumId)].isReleased = false
        })

        this.bandcampDomHandler.releaseChangedDateWarning(
          shareControls as HTMLElement,
          releaseDateStocked > 0 ? formatLocalDate(releaseDateStocked) : 'unknown',
          currentLd.datePublished ? formatLocalDate(currentLd.datePublished) : 'unknown',
        )
      }
    }

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'bcd-add-to-release-watch'

    // SVG eye icon
    this.bandcampDomHandler.updateWatchButton(button, isWatched)

    shareControls.appendChild(button)

    button.addEventListener('click', async () => {
      if (isWatched === false) {
        if (currentBlob) {
          const newReleaseData = this.buildReleaseFromLdJson(currentBlob, currentLd)
          await this.mutateAndSaveReleases((releases) => {
            releases[toKey(newReleaseData.itemId)] = newReleaseData
          })
        }
      }
      else {
        await this.mutateAndSaveReleases((releases) => {
          delete releases[toKey(currentBlob?.track_id || currentBlob?.album_id || 0)]
        })
      }

      // Toggle local state and update button
      isWatched = !isWatched
      this.bandcampDomHandler.updateWatchButton(button, isWatched)
    })

    const wishlistButton = document.querySelector('#collect-item')
    if (wishlistButton) {
      wishlistButton.addEventListener('click', () => {
        // Reverse class logic for wishlist button because the dom change happens after the click
        if (
          (wishlistButton.classList.contains('wishlisted') && !button.classList.contains('watched'))
          || (wishlistButton.classList.contains('wishlist') && button.classList.contains('watched'))
        ) {
          // Only trigger the button click if the state matches the conditions
          button.click()
        }
      })
    }
  }

  public processItem(item: HTMLElement, historyOfReleasedDate: Record<number, number>): Record<number, number> {
    const albumId = item.getAttribute('data-tralbumid') || item.getAttribute('data-itemid') || ''
    if (!albumId) {
      return historyOfReleasedDate
    }

    const albumIdInt = Number.parseInt(albumId, 10)
    if (Number.isNaN(albumIdInt)) {
      return historyOfReleasedDate
    }

    // Check if the album is already watched
    const isWatched = this.watchedReleases[toKey(albumIdInt)] !== undefined

    const artSection = item.querySelector('.collection-item-art-container')
    if (artSection && isWatched) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'bcd-release-watch-art'

      this.bandcampDomHandler.updateWatchButton(button, isWatched, 'mini')

      artSection.appendChild(button)

      button.addEventListener('click', async () => {
        const isCurrentlyWatched = this.watchedReleases[toKey(albumIdInt)] !== undefined

        await this.mutateAndSaveReleases((releases) => {
          if (isCurrentlyWatched) {
            const release = Object.values(releases).find(r => r.itemId === albumIdInt)
            if (release) {
              historyOfReleasedDate[albumIdInt] = release.releaseDate || 0
            }
            delete releases[toKey(albumIdInt)]
          }
          else {
            const maybeReleaseDate = historyOfReleasedDate[albumIdInt] || 0
            releases[toKey(albumIdInt)] = this.buildReleaseFromDomItem(item, albumIdInt, maybeReleaseDate)
          }
        })

        // Update button appearance
        this.bandcampDomHandler.updateWatchButton(button, !isCurrentlyWatched, 'mini')
      })
    }

    return historyOfReleasedDate
  }
}
