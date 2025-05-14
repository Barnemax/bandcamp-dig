export const EVENTS = {
  playlists: {
    loaded: 'bcd/playlists/loaded',
    update: 'bcd/playlists/update',
    updateTracks: 'bcd/playlists/updateTracks',
    updateStatus: 'bcd/playlists/updateStatus',
    processItem: 'bcd/playlists/processItem',
  },
  newReleases: {
    loaded: 'bcd/newReleases/watchedReleasesLoaded',
    processItem: 'bcd/newReleases/processItem',
    tabLoaded: 'bcd/newReleases/tabLoaded',
    addRelease: 'bcd/newReleases/addRelease',
    refresh: 'bcd/newReleases/refresh',
  },
  artists: {
    loaded: 'bcd/artists/watchedArtistsLoaded',
    scan: 'bcd/artists/scanForNewReleases',
  },
  cronTasks: {
    daily: 'bcd/cron/dailyEvent',
    skippedDaily: 'bcd/cron/skippedDailyEvent',
  },
  dom: {
    gridUpdate: 'bcd/dom/gridUpdate',
    retrieveTracks: 'bcd/dom/retrieveTracks',
    playerInteract: 'bcd/dom/playerInteract',
  },
  profile: {
    statistics: {
      loaded: 'bcd/profile/statistics/loaded',
    },
  },
}
