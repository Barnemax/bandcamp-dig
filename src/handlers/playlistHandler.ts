import type { DownloadItem, ItemStatus, PlaylistAction, PlaylistData, PlaylistItemAction, TabData } from '../shared/types'
import { FETCH_THROTTLE_MS } from '../shared/constants'
import { EVENTS } from '../shared/events'
import { StorageKeys } from '../shared/storageKeys'
import { strings } from '../shared/strings'
import { fetchDocument } from '../shared/utils'
import { BaseHandler } from './baseHandler'

export class PlaylistHandler extends BaseHandler {
  public userPlaylists: PlaylistData[] = []
  private loadedPlaylistsRevision: number = 0

  public hasLoadingConditions(): boolean {
    return this.bandcampDomHandler.isRelevantPage()
  }

  protected setupEventListeners(): void {
    this.onEvent(EVENTS.playlists.loaded, async () => {
      if (this.bandcampDomHandler.isOwnAccountPage()) {
        const tabArgs: TabData = {
          tabId: 'playlist',
          title: strings.t('playlist.tabTitle'),
          count: this.userPlaylists.length,
        }

        const playlistContainer = this.bandcampDomHandler.addTabToProfile(tabArgs)
        this.bandcampDomHandler.playlistInterface(this.userPlaylists, playlistContainer)
      }
      else if (this.bandcampDomHandler.isAlbumPage()) {
        this.bandcampDomHandler.displayPlaylistInterfaceInAlbumPage(this.userPlaylists)
        this.watchItemStatusChanges(document.body as HTMLElement)
      }
      else if (this.bandcampDomHandler.isDownloadPage()) {
        const downloadItems = this.bandcampDomHandler.currentBlob?.download_items as DownloadItem[] | undefined
        if (downloadItems && downloadItems.length > 0) {
          await this.mutateAndSavePlaylists((playlists) => {
            downloadItems.forEach((item) => {
              const itemId = Number(item.item_id)
              playlists.forEach((playlist) => {
                if (playlist.tracks[itemId]) {
                  playlist.tracks[itemId].itemStatus = 'owned'
                }
              })
            })
          })
        }
      }
    })

    // Only add interaction listeners on pages that support it
    if (this.bandcampDomHandler.isPageWithInteraction() === false) {
      return
    }

    this.onEvent<PlaylistAction>(EVENTS.playlists.update, async (detail) => {
      await this.updatePlaylistsData(detail)
      this.updatePlaylistsUI()
    })

    this.onEvent<PlaylistItemAction>(EVENTS.playlists.updateTracks, (detail) => {
      this.updatePlaylistTracks(detail)
    })

    this.onEvent<{ playlistId: number }>(EVENTS.playlists.updateStatus, (detail) => {
      this.updatePlaylistTracksStatus(detail.playlistId)
    })

    this.onEvent<{ item: HTMLElement }>(EVENTS.playlists.processItem, (detail) => {
      this.processItem(detail.item)
    })
  }

  private async savePlaylists(): Promise<void> {
    await this.saveToStorage(StorageKeys.playlists, this.userPlaylists)
  }

  private async mutateAndSavePlaylists(mutate: (data: PlaylistData[]) => void): Promise<void> {
    const { isStale, newRevision } = await this.checkRevisionAndBump('playlists', this.loadedPlaylistsRevision)
    if (isStale) {
      this.userPlaylists = await this.getUserPlaylists()
    }
    mutate(this.userPlaylists)
    this.loadedPlaylistsRevision = newRevision
    await this.savePlaylists()
  }

  public async updatePlaylistTracksStatus(playlistId: number): Promise<void> {
    // Sync with any changes from other tabs before starting the long operation
    const { isStale, newRevision } = await this.checkRevisionAndBump('playlists', this.loadedPlaylistsRevision)
    if (isStale) {
      this.userPlaylists = await this.getUserPlaylists()
    }
    this.loadedPlaylistsRevision = newRevision

    // Use the fetch function from background script to get updated info about each track in the playlist
    const playlistIndex = this.userPlaylists.findIndex(
      playlist => playlist.playlistId === playlistId,
    )

    if (playlistIndex === -1) {
      return
    }

    const playlistToUpdate = this.userPlaylists[playlistIndex]

    // Make a map of index with albumUrl
    const albumUrlMap: Record<number, string> = {}
    Object.values(playlistToUpdate.tracks).forEach((track) => {
      albumUrlMap[track.itemId] = track.albumUrl
    })

    const entries = Object.entries(albumUrlMap)
    const total = entries.length

    // Show progress dialog
    this.bandcampDomHandler.showProgressDialog({
      title: strings.t('playlist.updatingPlaylist', [playlistToUpdate.title]),
      current: 0,
      total,
      showCancel: true,
    })

    let current = 0
    for (const [itemId, albumUrl] of entries) {
      // Check if user cancelled
      if (this.bandcampDomHandler.isProgressCancelled()) {
        break
      }

      const getStatus = await this.fetchItemStatus(albumUrl)

      if (getStatus !== null) {
        playlistToUpdate.tracks[Number(itemId)].itemStatus = getStatus
      }

      current++
      this.bandcampDomHandler.updateProgressDialog({ current, total })

      // To avoid a timeout, add a small delay
      await new Promise(resolve => setTimeout(resolve, FETCH_THROTTLE_MS))
    }

    // Hide progress dialog
    this.bandcampDomHandler.hideProgressDialog()

    // Save updated playlist
    this.userPlaylists[playlistIndex] = playlistToUpdate
    await this.savePlaylists()
  }

  public async watchItemStatusChanges(item: HTMLElement): Promise<void> {
    const statusMap = this.getStatusMapForCurrentPage()

    statusMap.forEach(({ selector, status }) => {
      const element = item.querySelector(selector)
      if (!element) {
        return
      }

      element.addEventListener('click', () => {
        this.handleStatusChange(item, status)
      })
    })
  }

  private getStatusMapForCurrentPage(): Array<{ selector: string, status: ItemStatus }> {
    if (this.bandcampDomHandler.isOwnAccountPage()) {
      return [
        { selector: '.wishlisted-msg span.collect-item-icon.trigger', status: 'none' },
        { selector: '.wishlist-msg span.collect-item-icon', status: 'wishlisted' },
      ]
    }

    if (this.bandcampDomHandler.isAlbumPage()) {
      return [
        { selector: '#wishlisted-msg .action', status: 'none' },
        { selector: '#wishlist-msg.action', status: 'wishlisted' },
      ]
    }

    return []
  }

  private async handleStatusChange(item: HTMLElement, status: ItemStatus): Promise<void> {
    if (!item.querySelector('.playlists-containing-track li')) {
      return
    }

    const itemId = this.extractItemId(item)
    if (!itemId) {
      return
    }

    await this.mutateAndSavePlaylists((playlists) => {
      playlists.forEach((playlist) => {
        if (playlist.tracks[Number(itemId)]) {
          playlist.tracks[Number(itemId)].itemStatus = status
        }
      })
    })
  }

  private extractItemId(item: HTMLElement): string | null {
    if (this.bandcampDomHandler.isAlbumPage()) {
      const blob = this.bandcampDomHandler.currentBlob

      return blob?.track_id?.toString() ?? blob?.album_id?.toString() ?? null
    }

    if (this.bandcampDomHandler.isOwnAccountPage()) {
      return item.getAttribute('data-itemid')
    }

    return null
  }

  public updateItemStatusInPlaylists(itemId: number, status: ItemStatus): PlaylistData[] {
    this.userPlaylists.forEach((playlist) => {
      if (playlist.tracks[itemId]) {
        playlist.tracks[itemId].itemStatus = status
      }
    })
    return this.userPlaylists
  }

  public async fetchItemStatus(itemUrl: string): Promise<ItemStatus | null> {
    const itemDoc = await fetchDocument(itemUrl)
    if (itemDoc) {
      const pageDataElement = itemDoc.querySelector('#pagedata')
      let itemStatus: ItemStatus = 'none'

      if (pageDataElement) {
        const pageDataJson = pageDataElement.getAttribute('data-blob')
        if (pageDataJson) {
          let pageData: unknown
          try {
            pageData = JSON.parse(pageDataJson)
          }
          catch (err) {
            console.error('[BCD] Failed to parse page data-blob:', err)
            return null
          }

          const itemData = (pageData as Record<string, unknown>)?.fan_tralbum_data as Record<string, unknown> | undefined
          if (itemData) {
            if (itemData.is_purchased) {
              itemStatus = 'owned'
            }
            else if (itemData.is_wishlisted) {
              itemStatus = 'wishlisted'
            }

            return itemStatus
          }
        }
      }
    }

    return null
  }

  public determineCurrentAlbumItemStatus(): ItemStatus {
    let itemStatus: ItemStatus = 'none'
    const blob = this.bandcampDomHandler.currentBlob

    if (blob) {
      const itemData = blob.fan_tralbum_data
      if (itemData) {
        if (itemData.is_purchased) {
          itemStatus = 'owned'
        }
        else if (itemData.is_wishlisted) {
          itemStatus = 'wishlisted'
        }
      }
    }

    return itemStatus
  }

  public async getUserPlaylists(): Promise<PlaylistData[]> {
    const playlists = await this.loadFromStorage<PlaylistData[]>(StorageKeys.playlists, [])

    if (!this.validateArrayData<PlaylistData>(playlists, 'Playlists data is not an array:')) {
      return []
    }

    return playlists
  }

  public async initStorageData(): Promise<void> {
    if (this.loadingConditionsMet === false) {
      return
    }
    const [playlists, revisions] = await Promise.all([this.getUserPlaylists(), this.loadRevisions()])
    this.userPlaylists = playlists
    this.loadedPlaylistsRevision = revisions.playlists ?? 0
    this.dispatchEvent(EVENTS.playlists.loaded, { userPlaylists: this.userPlaylists })
  }

  private async updatePlaylistsData(details: PlaylistAction): Promise<void> {
    await this.mutateAndSavePlaylists((playlists) => {
      switch (details.action) {
        case 'create': {
          playlists.push(details.playlistData)
          break
        }
        case 'update': {
          const idx = playlists.findIndex(p => p.playlistId === details.playlistData.playlistId)
          if (idx !== -1) {
            playlists[idx] = details.playlistData
          }
          break
        }
        case 'delete': {
          const idx = playlists.findIndex(p => p.playlistId === details.playlistData.playlistId)
          if (idx !== -1) {
            playlists.splice(idx, 1)
          }
          break
        }
      }
    })
  }

  private updatePlaylistsUI(): void {
    if (this.bandcampDomHandler.isOwnAccountPage()) {
      const tab = document.querySelector('#grids [data-tab="playlist"] .count')
      if (tab) {
        tab.textContent = this.userPlaylists.length.toString()
      }

      const playlistContainer = document.querySelector('.playlist-list-container')
      if (playlistContainer) {
        this.bandcampDomHandler.displayPlaylistsList(this.userPlaylists, playlistContainer as HTMLElement)
      }
    }
  }

  private async updatePlaylistTracks(details: PlaylistItemAction): Promise<void> {
    switch (details.action) {
      case 'add': {
        const itemData = this.bandcampDomHandler.gatherTrackInfo(details.itemId)
        await this.mutateAndSavePlaylists((playlists) => {
          const idx = playlists.findIndex(p => p.playlistId === details.playlistId)
          if (idx !== -1 && !playlists[idx].tracks[itemData.itemId]) {
            playlists[idx].tracks[itemData.itemId] = itemData
            playlists[idx].lastUpdated = Date.now()
          }
        })
        break
      }
      case 'remove': {
        await this.mutateAndSavePlaylists((playlists) => {
          const idx = playlists.findIndex(p => p.playlistId === details.playlistId)
          if (idx !== -1) {
            delete playlists[idx].tracks[details.itemId]
          }
        })
        break
      }
    }
  }

  public processItem(item: HTMLElement): void {
    this.bandcampDomHandler.attachPlaylistSelector(item as HTMLElement, this.userPlaylists)
    this.watchItemStatusChanges(item as HTMLElement)
  }
}
