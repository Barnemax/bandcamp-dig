import type { ItemData, NewReleaseData } from '../shared/types'
import { strings } from '../shared/strings'
import { escapeHtml, formatLocalDate, safeUrl } from '../shared/utils'
import { icon } from './icons'

export function generateTrackListItem(data: ItemData, context: 'playlist' | 'new-releases'): HTMLElement {
  const itemType = data.typeItem || 't'
  const itemTypeLabel = itemType === 'a' ? strings.t('common.album') : strings.t('common.track')

  const li = document.createElement('li')
  li.id = `collection-item-container_${data.itemId}`
  li.className = 'bcd-item | collection-item-container track_play_hilite initial-batch'
  li.setAttribute('data-itemid', String(data.itemId))
  li.setAttribute('data-tralbumtype', itemType === 'a' ? 'a' : 't')
  li.setAttribute('data-itemtype', itemType === 'a' ? 'album' : 'track')
  li.setAttribute('data-tralbumid', String(data.itemId))
  li.setAttribute('data-bandid', String(data.bandId))
  li.setAttribute('data-ispurchasable', 'true')
  li.setAttribute('data-title', data.title)

  const streamingTitle = data?.bcStreamData?.title || data?.title

  const streamObject = {
    trackData: data.bcStreamData,
    artURL: data.imageUrl,
    title: streamingTitle,
    artist: data.artist,
    trackTitle: streamingTitle,
  }

  li.setAttribute('data-streaming', JSON.stringify(streamObject))

  const removeButton = context === 'playlist'
    ? `<div class="bcd-remove-from-playlist" title="${strings.t('playlist.removeFromPlaylist')}" aria-label="${strings.t('playlist.removeFromPlaylist')}" role="button">${icon('close')}</div>`
    : ''

  const itemTypeInfo = context === 'playlist'
    ? `<div class="bcd-type" title="${itemTypeLabel}">${itemType}</div>`
    : ''

  const itemStatusInfo = context === 'playlist' && data.itemStatus && data.itemStatus !== 'none'
    ? `<div class="bcd-status ${data.itemStatus}" title="${data.itemStatus}"></div>`
    : ''

  const safeTitle = escapeHtml(data.title)
  const safeArtist = escapeHtml(data.artist)
  const safeAlbumUrl = safeUrl(data.albumUrl)
  const safeImageUrl = safeUrl(data.imageUrl)

  li.innerHTML = `
        <div class="collection-item-gallery-container">
          <div class="collection-item-art-container">
            <a class="track_play_auxiliary" data-itemid="${data.itemId}">
              <img class="collection-item-art" alt="${safeTitle}" src="${safeImageUrl}">
              <span class="item_link_play" tabindex="0">
                <span class="item_link_play_bkgd round4"></span>
                <span class="item_link_play_widget bc-ui"></span>
              </span>
            </a>
          </div>
          <div class="collection-title-details">
            <a target="_blank" href="${safeAlbumUrl}" class="item-link">
              <div class="collection-item-title">${safeTitle}</div>
              <div class="collection-item-artist">${strings.t('common.byArtist', [safeArtist])}</div>
            </a>
            ${itemTypeInfo}
            ${itemStatusInfo}
            ${removeButton}
          </div>
        </div>

        <div class="item-details-container">
          <span class="item-link-alt">
            <div class="collection-item-title">${safeTitle}</div>
            <div class="collection-item-artist">${strings.t('common.byArtist', [safeArtist])}</div>
          </span>
          <div class="collection-item-actions wishlisted">
            <ul>
              <li class="first" id="collect-item_${data.itemId}">
              </li>
            </ul>
          </div>
        </div>
      `
  return li
}

export function generateSummaryOfUpcomingReleases(upcomingReleases: NewReleaseData[]): HTMLElement {
  const container = document.createElement('div')
  container.className = 'bcd-upcoming-releases-summary'

  const releasesByDate: Record<string, NewReleaseData[]> = {}
  upcomingReleases.forEach((release) => {
    const dateKey = formatLocalDate(new Date(release.releaseDate))
    if (!releasesByDate[dateKey]) {
      releasesByDate[dateKey] = []
    }
    releasesByDate[dateKey].push(release)
  })

  const table = document.createElement('table')
  table.className = 'bcd-upcoming-releases-table'

  table.innerHTML = `
    <thead>
    <tr>
      <th>${strings.t('newReleases.releaseDate')}</th>
      <th>${strings.t('newReleases.releases')}</th>
      <th>${strings.t('newReleases.artist')}</th>
    </tr>
    </thead>
    <tbody>
    ${Object.entries(releasesByDate).map(([date, releases]) => `
      <tr>
      <td>${date}</td>
      <td>${releases.map(r => `<div><a target="_blank" href="${safeUrl(r.albumUrl)}">${escapeHtml(r.title)}</a></div>`).join('')}</td>
      <td>${releases.map(r => `<div>${escapeHtml(r.artist)}</div>`).join('')}</td>
      </tr>
    `).join('')}
    </tbody>
  `

  container.appendChild(table)
  return container
}
