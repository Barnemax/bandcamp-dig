window.addEventListener('bcd/dom/playerInteract', (event) => {
  const data = event.detail

  if (window.collectionPlayer && window.collectionPlayer.player2 && data?.trackData) {
    if (window.currentPlayingTrack === data.trackData.id) {
      window.collectionPlayer.player2.playPause()
    }
    else {
      window.currentPlayingTrack = data.trackData.id
      window.collectionPlayer.player2.stop()
      window.collectionPlayer.player2.setTracklist([data])
      window.collectionPlayer.player2.goToTrack(0)
    }
  }
})
