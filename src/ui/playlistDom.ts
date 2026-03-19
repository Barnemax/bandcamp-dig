import type { ItemData, PlaylistAction, PlaylistData } from '../shared/types'
import { EVENTS } from '../shared/events'
import { strings } from '../shared/strings'
import { dispatchCustomEvent, escapeHtml, safeUrl } from '../shared/utils'
import { icon } from './icons'
import { generateTrackListItem } from './trackListRenderer'

export class PlaylistDomService {
  private gatherTrackInfoFn: (itemId?: number) => ItemData

  constructor(gatherTrackInfoFn: (itemId?: number) => ItemData) {
    this.gatherTrackInfoFn = gatherTrackInfoFn
  }

  public playlistInterface(userPlaylists: PlaylistData[], playlistContainer: HTMLElement | null): void {
    if (!playlistContainer) {
      return
    }

    playlistContainer.innerHTML = ''

    let playlistsListContainer = playlistContainer.querySelector('.playlist-list-container') as HTMLElement

    if (!playlistsListContainer) {
      playlistsListContainer = document.createElement('div')
      playlistsListContainer.className = 'playlist-list-container'
      playlistContainer.appendChild(playlistsListContainer)
    }

    this.displayPlaylistsList(userPlaylists, playlistsListContainer)
  }

  public displayPlaylistsList(playlists: PlaylistData[], container: HTMLElement): void {
    container.innerHTML = ''
    const list = document.createElement('ul')
    list.className = 'playlist-list'

    const createItem = document.createElement('li')
    createItem.className = 'playlist-item playlist-item-create'
    const form = this.getPlaylistCreationForm()
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      const title = (form.querySelector('#playlist-title') as HTMLInputElement).value
      const description = (form.querySelector('#playlist-description') as HTMLTextAreaElement).value
      const playlistData: PlaylistData = {
        playlistId: Date.now(),
        title: title.trim(),
        description: description.trim(),
        tracks: {},
        lastUpdated: Date.now(),
      }
      const playlistEvent = new CustomEvent<PlaylistAction>(EVENTS.playlists.update, {
        detail: { action: 'create', playlistData },
      })
      window.dispatchEvent(playlistEvent)
      form.reset()
    })
    createItem.appendChild(form)
    list.appendChild(createItem)

    const sorted = [...(playlists || [])].sort((a, b) => b.lastUpdated - a.lastUpdated)
    sorted.forEach((pl) => {
      const itemImg: string[] = []

      for (const trackId in pl.tracks) {
        if (itemImg.length >= 4) {
          break
        }

        const track = pl.tracks[trackId]
        if (track.imageUrl) {
          itemImg.push(track.imageUrl)
        }
      }

      const imagesHtml = itemImg.map(url => `<img src="${safeUrl(url)}" alt="Track Image" class="playlist-track-image">`).join('')
      const maybeDescription = pl.description ? `<p>${escapeHtml(pl.description)}</p>` : ''

      const item = document.createElement('li')
      item.className = 'playlist-item'
      item.id = `playlist-${pl.playlistId}`
      item.innerHTML = `
        <div class="playlist-images-container">
          ${imagesHtml}
          <div class="playlist-image-overlay">${icon('eye')}</div>
        </div>
        <div class="playlist-info">
          <h3 class="playlist-title">${escapeHtml(pl.title)}</h3>
          ${maybeDescription}
          <span class="track-count">${strings.tp('playlist.itemCount', Object.keys(pl.tracks).length)}</span>
          <span class="last-updated">${strings.t('playlist.lastUpdated', [new Date(pl.lastUpdated).toLocaleDateString()])}</span>
        </div>
        <button class="delete-playlist-btn" title="${strings.t('playlist.deletePlaylist')}" aria-label="${strings.t('playlist.deletePlaylist')}">${icon('close')}</button>
      `

      const deleteBtn = item.querySelector('.delete-playlist-btn') as HTMLButtonElement
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation()
          if (confirm(strings.t('playlist.confirmDelete', [pl.title]))) {
            const deleteEvent = new CustomEvent<PlaylistAction>(EVENTS.playlists.update, {
              detail: {
                action: 'delete',
                playlistData: pl,
              },
            })

            window.dispatchEvent(deleteEvent)
          }
        })
      }

      item.addEventListener('click', () => {
        const parentContainer = container.parentElement
        if (parentContainer) {
          this.showPlaylistDetail(pl, parentContainer, container)
        }
      })

      list.appendChild(item)
    })
    container.appendChild(list)
  }

  private showPlaylistDetail(pl: PlaylistData, parentContainer: HTMLElement, listContainer: HTMLElement): void {
    listContainer.style.display = 'none'
    parentContainer.querySelector('.playlist-detail-view')?.remove()

    const detailView = document.createElement('div')
    detailView.className = 'playlist-detail-view'

    const headerRow = document.createElement('div')
    headerRow.className = 'playlist-display-header'

    const backBtn = document.createElement('button')
    backBtn.className = 'playlist-back-btn'
    backBtn.innerHTML = `${icon('arrowLeft')}${strings.t('common.back')}`
    backBtn.addEventListener('click', () => {
      detailView.remove()
      listContainer.style.display = ''
    })

    const header = document.createElement('h4')
    header.textContent = strings.t('playlist.tracksInPlaylist', [pl.title])

    const refreshBtn = document.createElement('button')
    refreshBtn.className = 'update-playlist-btn'
    refreshBtn.title = strings.t('playlist.updateInfo')
    refreshBtn.innerHTML = icon('refresh')
    refreshBtn.addEventListener('click', () => {
      const updateEvent = new CustomEvent(EVENTS.playlists.updateStatus, {
        detail: { playlistId: pl.playlistId },
      })
      window.dispatchEvent(updateEvent)
    })

    const leftGroup = document.createElement('div')
    leftGroup.className = 'playlist-display-header-left'
    leftGroup.appendChild(backBtn)
    leftGroup.appendChild(header)

    headerRow.appendChild(leftGroup)
    headerRow.appendChild(refreshBtn)

    const tracksWrapper = document.createElement('div')
    tracksWrapper.className = 'playlist-tracks-list'

    const trackGrid = document.createElement('ol')
    trackGrid.className = 'collection-grid'

    const sortedTracks = Object.values(pl.tracks).sort((a, b) => b.addedAt - a.addedAt)
    sortedTracks.forEach((track) => {
      trackGrid.appendChild(generateTrackListItem(track, 'playlist'))
    })

    trackGrid.querySelectorAll('.bcd-remove-from-playlist').forEach((removeBtn) => {
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        const trackItem = (e.target as HTMLElement).closest('.bcd-item') as HTMLElement
        if (!trackItem) {
          return
        }
        const itemId = Number.parseInt(trackItem.getAttribute('data-itemid') || '0')
        dispatchCustomEvent(EVENTS.playlists.updateTracks, { action: 'remove', itemId, playlistId: pl.playlistId })
        trackItem.remove()
      })
    })

    tracksWrapper.appendChild(trackGrid)
    detailView.appendChild(headerRow)
    detailView.appendChild(tracksWrapper)
    parentContainer.appendChild(detailView)
  }

  private getPlaylistCreationForm(): HTMLFormElement {
    const form = document.createElement('form')
    form.id = 'playlist-creation-form'
    form.innerHTML = `
      <div class="playlist-create-visual">${icon('plus')}</div>
      <div class="playlist-info">
        <input type="text" id="playlist-title" name="title" placeholder="Playlist title" required>
        <textarea id="playlist-description" name="description" maxlength="50" placeholder="Description (optional)"></textarea>
        <button type="submit">${strings.t('playlist.createPlaylist')}</button>
      </div>
    `
    return form
  }

  public displayPlaylistInterfaceInAlbumPage(userPlaylists: PlaylistData[], currentBlob: { track_id?: number, album_id?: number } | null): void {
    const shareControls = document.querySelector('.share-collect-controls')

    if (!shareControls) {
      return
    }

    const playlistContainer = document.createElement('div')
    playlistContainer.id = 'playlist-interface'
    playlistContainer.className = 'playlist-interface'

    const trackId = Number(currentBlob?.track_id) || Number(currentBlob?.album_id) || 0
    const allPlaylistsList = this.playlistManager(userPlaylists, trackId)

    playlistContainer.appendChild(allPlaylistsList)
    shareControls.appendChild(playlistContainer)
  }

  public attachPlaylistSelector(item: HTMLElement, userPlaylists: PlaylistData[]): void {
    if (!item) {
      return
    }

    if (item.querySelector('.bcd-playlist-selector')) {
      return
    }

    const itemId = Number.parseInt(item.getAttribute('data-itemid') || '0')
    const manager = this.playlistManager(userPlaylists, itemId)
    item.appendChild(manager)
  }

  private playlistManager(userPlaylists: PlaylistData[], itemId: number): HTMLElement {
    const existingSelector = document.querySelector(`.bcd-playlist-selector[data-itemid="${itemId}"]`)
    if (existingSelector) {
      return existingSelector as HTMLElement
    }

    const togglePlaylistManagerTitle = (isOpen: boolean): string => {
      return isOpen ? strings.t('playlist.managerDone') : strings.t('playlist.managerTitle')
    }

    const selectorHTML = `
      <div class="bcd-playlist-selector" data-itemid="${itemId}">
        <button class="bcd-playlist-manager-trigger">${togglePlaylistManagerTitle(false)}</button>
        <div class="all-playlists-list" data-itemid="${itemId}" style="display: none;">
          <div class="playlist-selector-wrapper">
            <div class="bcd-playlist-search">
              <span class="playlist-search-icon">${icon('search')}</span>
              <input type="text" placeholder="${strings.t('playlist.searchOrCreate')}" class="playlist-input">
              <button class="playlist-create-btn inactive">${icon('plus')}</button>
            </div>
            <div class="playlist-options-list"></div>
          </div>
        </div>
        <div class="track-in-playlists-container"></div>
      </div>
    `

    const temp = document.createElement('div')
    temp.innerHTML = selectorHTML
    const selector = temp.firstElementChild as HTMLElement

    const selectButton = selector.querySelector('.bcd-playlist-manager-trigger') as HTMLButtonElement
    const container = selector.querySelector('.all-playlists-list') as HTMLElement
    const trackInPlaylistsContainer = selector.querySelector('.track-in-playlists-container') as HTMLElement
    const input = selector.querySelector('.playlist-input') as HTMLInputElement
    const createBtn = selector.querySelector('.playlist-create-btn') as HTMLButtonElement
    const listContainer = selector.querySelector('.playlist-options-list') as HTMLElement

    selectButton.addEventListener('click', () => {
      container.style.display = container.style.display === 'none' ? '' : 'none'
      selectButton.innerHTML = togglePlaylistManagerTitle(container.style.display !== 'none')
    })

    const updateTrackInPlaylistsDisplay = (list: PlaylistData[] = userPlaylists): void => {
      const playlistsWithTrack = list.filter(pl =>
        pl.tracks && pl.tracks[itemId] !== undefined,
      )

      if (playlistsWithTrack.length > 0) {
        const playlistItems = playlistsWithTrack
          .map(pl => `<li>${escapeHtml(pl.title)}</li>`)
          .join('')
        trackInPlaylistsContainer.innerHTML = `<ul class="playlists-containing-track">${playlistItems}</ul>`
      }
      else {
        trackInPlaylistsContainer.innerHTML = ''
      }
    }

    const trackStatusIcon = (isChecked: boolean): string => {
      return isChecked ? icon('check') : icon('uncheck')
    }

    const renderList = (filter: string = '', list: PlaylistData[] = userPlaylists): void => {
      const filtered = list
        .filter(pl => pl.title.toLowerCase().includes(filter.toLowerCase()))
        .sort((a, b) => b.lastUpdated - a.lastUpdated)

      const hasExactMatch = filtered.some(pl => pl.title.toLowerCase() === filter.toLowerCase())
      createBtn.classList.toggle('inactive', !(filter.trim() !== '' && !hasExactMatch))

      const playlistOptions = filtered
        .map((pl) => {
          const isInPlaylist = !!(pl.tracks && pl.tracks[itemId] !== undefined)

          return `
            <div class="playlist-select-option${isInPlaylist ? ' selected' : ''}" data-playlist-id="${pl.playlistId}">
              <span class="playlist-select-label">${escapeHtml(pl.title)}</span>
              <span class="playlist-select-icon">${trackStatusIcon(isInPlaylist)}</span>
            </div>
          `
        })
        .join('')

      listContainer.innerHTML = playlistOptions

      listContainer.querySelectorAll('.playlist-select-option').forEach((option) => {
        option.addEventListener('click', () => {
          const playlistId = Number(option.getAttribute('data-playlist-id'))
          const pl = userPlaylists.find(p => p.playlistId === playlistId)
          if (!pl) {
            return
          }

          const isInPlaylist = !!(pl.tracks && pl.tracks[itemId] !== undefined)
          const iconElement = option.querySelector('.playlist-select-icon')

          const playlistEvent = new CustomEvent(EVENTS.playlists.updateTracks, {
            detail: {
              playlistId: pl.playlistId,
              itemId,
              action: isInPlaylist ? 'remove' : 'add',
            },
          })

          window.dispatchEvent(playlistEvent)

          option.classList.toggle('selected')
          if (iconElement) {
            iconElement.innerHTML = trackStatusIcon(option.classList.contains('selected'))
          }

          if (isInPlaylist) {
            delete pl.tracks[itemId]
          }
          else {
            pl.tracks[itemId] = this.gatherTrackInfoFn(itemId)
          }
          pl.lastUpdated = Date.now()

          renderList(input.value)
          updateTrackInPlaylistsDisplay()
        })
      })
    }

    const createPlaylist = (): void => {
      const title = input.value.trim()
      if (!title) {
        return
      }

      const playlistData: PlaylistData = {
        playlistId: Date.now(),
        title,
        description: '',
        tracks: {},
        lastUpdated: Date.now(),
      }

      if (itemId) {
        playlistData.tracks[itemId] = this.gatherTrackInfoFn(itemId)
      }

      const playlistEvent = new CustomEvent(EVENTS.playlists.update, {
        detail: {
          action: 'create',
          playlistData,
        },
      })

      window.dispatchEvent(playlistEvent)

      input.value = ''

      const optimisticList = [...userPlaylists, playlistData]
      renderList('', optimisticList)
      updateTrackInPlaylistsDisplay(optimisticList)
    }

    if (!container.dataset.initialized) {
      createBtn.addEventListener('click', createPlaylist)

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !createBtn.classList.contains('inactive')) {
          e.preventDefault()
          createPlaylist()
        }
      })

      input.addEventListener('input', () => {
        renderList(input.value)
      })

      renderList()
      updateTrackInPlaylistsDisplay()

      container.dataset.initialized = 'true'
    }

    return selector
  }
}
