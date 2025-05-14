// Storage keys with proper typing for WXT storage API
export const StorageKeys = {
  watchedReleases: 'local:watchedReleases',
  watchedArtists: 'local:watchedArtists',
  playlists: 'local:userPlaylists',
  dailyCheck: 'local:dailyCheck',
  userStats: 'local:userStats',
  userSettings: 'local:userSettings',
  onboardingCache: 'local:onboardingCache',
  onboardingLock: 'local:onboardingLock',
  lastArtistScan: 'local:lastArtistScan',
  userSettingsPlaylistFeature: 'playlist/feature',
  userSettingsNewReleaseFeature: 'release/feature',
  userSettingsProfileStatisticsFeature: 'profile/feature',
  userSettingsDarkModePreferenceFeature: 'darkModePreference/feature',
} as const

// Type for storage keys that use local storage (for WXT storage API)
export type LocalStorageKey = typeof StorageKeys[keyof typeof StorageKeys] & `local:${string}`

export const DEFAULT_SETTINGS = {
  [StorageKeys.userSettingsPlaylistFeature]: true,
  [StorageKeys.userSettingsNewReleaseFeature]: true,
  [StorageKeys.userSettingsProfileStatisticsFeature]: false,
  [StorageKeys.userSettingsDarkModePreferenceFeature]: false,
} as const
