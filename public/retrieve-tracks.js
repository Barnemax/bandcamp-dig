window.dispatchEvent(new CustomEvent('bcd/dom/retrieveTracks', {
  detail: document.body.classList.contains('tralbum-page')
    ? { type: 'tralbum', data: window.TralbumData?.trackinfo ?? null }
    : { type: 'collection', data: window.collectionPlayer?.tracklists ?? null },
}))
