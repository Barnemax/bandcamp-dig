import type { TracklistEntry, TralbumTrackInfo, TralbumType } from '@barnemax/bandcamp-types'

export type { CollectionPageBlob, DownloadItem, DownloadPageBlob, LoosePageBlob, PageBlob, ReleaseLdJson, TracklistEntry, TralbumPageBlob, TralbumTrackInfo, TralbumType } from '@barnemax/bandcamp-types'

export type ItemStatus = 'owned' | 'wishlisted' | 'none'

export interface ItemData {
  typeItem: TralbumType
  itemId: number
  title: string
  artist: string
  albumUrl: string
  imageUrl: string
  bandId: number
  bcStreamData: TracklistEntry | Record<string, never>
  addedAt: number // Timestamp when the track was added to the playlist
  itemStatus: ItemStatus // Whether the item is owned by the user
}

export interface NewReleaseData extends ItemData {
  releaseDate: number // Date when the release was made (timestamp)
  isReleased?: boolean // Optional: Whether the release has been released
}

export interface ArtistWatchData {
  bandId: number
  bandName: string
  bandUrl: string // https://astralindustries.bandcamp.com
  imageUrl: string
  lastTimeChecked: number // Timestamp of the last time releases were checked
  lastReleaseChecked: string // itemId of the last release checked
}

export interface TabData {
  tabId: string
  title: string
  count: number
}

export interface PlaylistData {
  playlistId: number
  title: string
  description?: string
  tracks: Record<number, ItemData> // Keyed by itemId
  lastUpdated: number
}

export interface PlaylistAction {
  action: 'create' | 'update' | 'delete'
  playlistData: PlaylistData
}

export interface PlaylistItemAction {
  action: 'add' | 'remove'
  playlistId: number
  itemId: number
}

export interface DailyCheckData {
  lastChecked: string // Date in YYYY-MM-DD format
}

export interface ProfileStatistics {
  views: number // Number of views
  timesPlayed: number // Number of times played
  followers: number // Number of followers
}

export type StatisticsType = 'since' | 'last' // 'since' = last time the user logged in, 'last' = last 7 days

export interface StatisticsRenderArgs {
  evolution: ProfileStatistics
  statisticsType: StatisticsType
  lastRecordDate?: string
}

export interface ProgressDialogUpdateOptions {
  current: number
  total: number
  title?: string
  description?: string
}

export interface FoundRelease {
  title: string
  artist: string
  url: string
}

export interface ProgressSummaryOptions {
  title: string
  summary: string | string[] // Single message or array of lines
  foundReleases?: FoundRelease[]
  onClose?: () => void
}

export type Settings = Record<string, boolean>

export interface ResolvedArtist {
  band_id: number
  band_name: string
  band_url: string
  count: number
  resolvedName: string
  resolvedImageUrl: string
  lastReleaseId: string
}

export interface OnboardingCache {
  timestamp: number
  resolved: ResolvedArtist[]
}

export interface OnboardingLock {
  timestamp: number
}

// ---------------------------------------------------------------------------
// Extension-specific collection model (built on top of Bandcamp's raw data)
// ---------------------------------------------------------------------------

export interface CollectionTrackItem {
  tralbumType: TralbumType
  tralbumId: number
  tralbumKey: string
  bandId: number
  trackData: TracklistEntry
  artURL: string
  title: string
  artist: string
  trackNumber: number
  trackTitle: string
  tralbumBuyUrl: string
}

export interface CollectionTracklists {
  collection: Record<string, CollectionTrackItem[]>
  wishlist: Record<string, CollectionTrackItem[]>
}

export interface CollectionBandcampData {
  type: 'collection'
  data: CollectionTracklists
}

export interface TralbumBandcampData {
  type: 'tralbum'
  data: TralbumTrackInfo[]
}

export type WindowBandcampData = CollectionBandcampData | TralbumBandcampData
