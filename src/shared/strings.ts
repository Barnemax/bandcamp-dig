const texts = {
  common: {
    cancel: 'Cancel',
    ok: 'OK',
    back: 'Back',
    album: 'Album',
    track: 'Track',
    byArtist: 'by $1',
  },
  popup: {
    title: 'Bandcamp Dig',
    features: 'Features',
    dataMigration: 'Data Migration',
    export: 'Export',
    import: 'Import',
    links: 'Links',
    donate: 'Donate',
    github: 'GitHub',
    featureRequest: 'Feature request',
    rateExtension: 'Rate extension',
    settingsButton: 'BC Dig settings',
  },
  welcome: {
    featurePlaylist: '📋 Create and manage custom playlists',
    featureReleases: '🔔 Track new releases from your favorite artists',
    featureStats: '📊 View your profile statistics evolution',
    featureDarkMode: '🌙 Dark mode support',
    getStarted: 'Get Started',
  },
  settings: {
    playlistManager: '📋 Playlist manager',
    newReleases: '🔔 New releases tracking',
    profileStats: '📊 Profile statistics',
    darkMode: '🌙 Dark mode',
  },
  playlist: {
    tabTitle: 'playlists',
    emptyState: 'You don\'t have any playlists yet.',
    itemCount: { none: '0 items', one: '1 item', many: '$1 items' },
    lastUpdated: 'Last updated: $1',
    show: 'Show',
    deletePlaylist: 'Delete playlist',
    updateInfo: 'Update Info',
    confirmDelete: 'Are you sure you want to delete the playlist "$1"?',
    tracksInPlaylist: 'Tracks in "$1"',
    confirmUpdate:
      'Are you sure you want to update the playlist info from Bandcamp page data? It will take some time you need to keep the page open.',
    formTitle: 'Playlist Title:',
    formDescription: 'Description:',
    createPlaylist: 'Create Playlist',
    managerDone: 'Done',
    managerTitle: 'Playlist Manager',
    searchOrCreate: 'Search or create',
    removeFromPlaylist: 'Remove from playlist',
    updatingPlaylist: 'Updating "$1"',
  },
  newReleases: {
    tabTitle: 'new releases',
    upcomingReleases: 'Upcoming Releases',
    addToWatch: 'Add to release watch',
    removeFromWatch: 'Remove from release watch',
    releaseDateChanged: 'Notice: The release date has changed from $1 to $2 by the artist. We updated the data.',
    releaseDate: 'Release Date',
    releases: 'Releases',
    artist: 'Artist',
  },
  artistWatch: {
    fetchButton: 'Check for new releases',
    fetching: 'Fetching...',
    fetchComplete: 'Fetch Complete!',
    watchedArtists: 'Watched Artists/Labels',
    stopWatching: 'Stop watch',
    watchReleases: 'Watch',
    scanningTitle: 'Scanning Watched Artists',
    fetchingBatch: 'Fetching: $1…',
    lastScan: 'Last scan: $1',
    processingReleases: 'Processing releases for $1 ($2-$3 of $4)...',
    scannedArtist: 'Scanned $1 ($2 of $3)',
    scanCompleteTitle: 'Watched Artists Scan Complete',
    scannedCount: { none: 'Scanned 0 artists.', one: 'Scanned 1 artist.', many: 'Scanned $1 artists.' },
    addedCount: 'Added $1 to release watch.',
    onboardingTitle: 'Watch artists from your collection',
    onboardingDescription: 'Select artists/labels to track new releases for. Note that it might make more sense to select only active artist/labels.',
    onboardingLoading: 'Loading your collection…',
    onboardingEmpty: 'No collection items found.',
    onboardingLocked: 'Onboarding is already running in another tab.',
    onboardingItemCount: { none: 'no purchases', one: '1 purchase', many: '$1 purchases' },
    onboardingWatchSelected: 'Watch selected ($1)',
    onboardingWatchAll: 'Watch all ($1)',
    onboardingFetching: 'Fetching artist info ($1/$2)…',
  },
  stats: {
    evolutionTitle: 'Your stats evolution',
    since: ' since $1',
    days: ' ($1 days)',
    lastWeek: ' from the last 7 days',
    views: 'Views',
    timesPlayed: 'Times Played',
    followers: 'Followers',
  },
  dataMigration: {
    importComplete: 'Import completed! Refresh your page to apply the changes.',
    importError: 'Import failed: the file is invalid or corrupted.',
    pasteInstruction: 'Paste the contents of your export file:',
    pasteConfirm: 'Import',
  },
}

function t(key: string, params?: string[]): string {
  const parts = key.split('.')
  let value: unknown = texts
  for (const part of parts) {
    value = (value as Record<string, unknown>)[part]
    if (value === undefined) {
      return key
    }
  }
  let result = value as string
  if (params) {
    params.forEach((param, i) => {
      result = result.replaceAll(`$${i + 1}`, param)
    })
  }
  return result
}

function tp(key: string, count: number): string {
  const parts = key.split('.')
  let value: unknown = texts

  for (const part of parts) {
    value = (value as Record<string, unknown>)[part]
    if (value === undefined) {
      return key
    }
  }

  const obj = value as { none?: string, one?: string, many?: string }
  const template = count === 0 ? (obj.none ?? key) : count === 1 ? (obj.one ?? key) : (obj.many ?? key)

  return template.replace('$1', String(count))
}

export const strings = { t, tp }
