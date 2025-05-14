export function shouldLoadExtensionFeatures(): boolean {
  return isUserConnected() && isRelevantPage()
}

export function isUserConnected(): boolean {
  return document.querySelector('.login-link') === null
}

export function isDownloadPage(): boolean {
  return document.querySelector('.download-info-container.has-downloads') !== null
}

export function isAccountPage(): boolean {
  return document.querySelector('.fan-bio-inner') !== null
}

export function isAlbumPage(): boolean {
  return document.querySelector('.tralbum-page') !== null
}

export function isRelevantPage(): boolean {
  return isAccountPage() || isAlbumPage() || isDownloadPage() || isArtistPage()
}

export function isArtistPage(): boolean {
  return document.querySelector('#band-navbar, #bio-container') !== null && !isAlbumPage()
}
