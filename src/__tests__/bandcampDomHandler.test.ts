import type { CollectionTrackItem, ReleaseLdJson, TracklistEntry } from '../shared/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BandcampDomHandler } from '../handlers/bandcampDomHandler'
import * as pageDetection from '../shared/pageDetection'

vi.mock('../ui/playlistDom', () => ({
  PlaylistDomService: class {
    constructor() {}
  },
}))

vi.mock('../ui/progressDialog', () => ({
  ProgressDialog: class {
    isCancelled(): boolean { return false }
  },
}))

vi.mock('../ui/trackListRenderer', () => ({
  generateTrackListItem: vi.fn(),
  generateSummaryOfUpcomingReleases: vi.fn(),
}))

vi.mock('../assets/css/content.scss', () => ({}))

vi.mock('../shared/pageDetection', () => ({
  isUserConnected: vi.fn(() => true),
  isRelevantPage: vi.fn(() => true),
  isAlbumPage: vi.fn(() => false),
  isAccountPage: vi.fn(() => false),
  isArtistPage: vi.fn(() => false),
  isDownloadPage: vi.fn(() => false),
}))

// Minimal document stub — only the surface area used by gatherTrackInfo on the collection path
function stubDocument(itemId: string, elementAttrs?: Record<string, string>, containerClass?: string): void {
  const querySelector = (selector: string): object | null => {
    if (selector === `[data-itemid="${itemId}"]` && itemId) {
      return {
        getAttribute: (attr: string): string | null => elementAttrs?.[attr] ?? null,
        closest: (sel: string): object | null => {
          if (!containerClass) {
            return null
          }
          if (sel === '.collection-items') {
            return { id: containerClass }
          }
          return null
        },
        querySelector: (sel: string): object | null => {
          if (sel === '.collection-item-artist') {
            return { textContent: elementAttrs?.artist ?? '' }
          }
          if (sel === '.collection-title-details a') {
            return { getAttribute: (a: string): string | null => a === 'href' ? (elementAttrs?.href ?? null) : null }
          }
          if (sel === 'img.collection-item-art') {
            return { getAttribute: (a: string): string | null => a === 'src' ? (elementAttrs?.src ?? null) : null }
          }
          return null
        },
      }
    }
    return null
  }

  vi.stubGlobal('document', {
    querySelector,
    getElementById: (): null => null,
    createElement: (): object => ({ src: '', id: '', onload: null, remove: (): void => {} }),
    documentElement: { appendChild: () => {} },
  })
}

const baseTrackData: TracklistEntry = { id: 0, title: '', track_number: 1, duration: 180, file: {} }

function makeCollectionItem(overrides?: Partial<CollectionTrackItem>): CollectionTrackItem {
  return {
    tralbumType: 'a',
    tralbumId: 123,
    tralbumKey: 'a123',
    bandId: 456,
    trackData: baseTrackData,
    artURL: 'https://f4.bcbits.com/img/test.jpg',
    title: 'Test Album',
    artist: 'Test Artist',
    trackNumber: 1,
    trackTitle: 'Test Track',
    tralbumBuyUrl: 'https://artist.bandcamp.com/album/test',
    ...overrides,
  }
}

describe('bandcampDomHandler — gatherTrackInfo (collection path)', () => {
  let handler: BandcampDomHandler

  beforeEach(() => {
    stubDocument('')
    handler = new BandcampDomHandler()
    // Set currentBlob so isOwnAccountPage() returns true
    handler.currentBlob = { fan_data: { is_own_page: true } } as any
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('resolves an owned album via windowBandcampData collection', () => {
    const item = makeCollectionItem({ tralbumType: 'a', tralbumId: 123 })
    handler.windowBandcampData = {
      type: 'collection',
      data: { collection: { a123: [item] }, wishlist: {} },
    }
    stubDocument('123', { 'data-itemid': '123' })

    const result = handler.gatherTrackInfo(123)

    expect(result.itemId).toBe(123)
    expect(result.typeItem).toBe('a')
    expect(result.itemStatus).toBe('owned')
    expect(result.title).toBe('Test Album')
    expect(result.artist).toBe('Test Artist')
    expect(result.bandId).toBe(456)
    expect(result.albumUrl).toBe('https://artist.bandcamp.com/album/test')
    expect(result.imageUrl).toBe('https://f4.bcbits.com/img/test.jpg')
  })

  it('resolves a wishlisted album — wishlist takes priority over collection', () => {
    const wishlistItem = makeCollectionItem({ title: 'Wishlist Album' })
    const collectionItem = makeCollectionItem({ title: 'Collection Album' })
    handler.windowBandcampData = {
      type: 'collection',
      data: { collection: { a123: [collectionItem] }, wishlist: { a123: [wishlistItem] } },
    }
    stubDocument('123', { 'data-itemid': '123' })

    const result = handler.gatherTrackInfo(123)

    expect(result.itemStatus).toBe('wishlisted')
    expect(result.title).toBe('Wishlist Album')
  })

  it('resolves an owned track via t-prefixed key, uses trackData.id for itemId', () => {
    const td: TracklistEntry = { id: 789, title: 'Single', track_number: 1, duration: 200, file: { 'mp3-128': 'https://stream.example.com/track.mp3' } }
    const item = makeCollectionItem({ tralbumType: 't', tralbumId: 789, trackData: td })
    handler.windowBandcampData = {
      type: 'collection',
      data: { collection: { t789: [item] }, wishlist: {} },
    }
    stubDocument('789', { 'data-itemid': '789' })

    const result = handler.gatherTrackInfo(789)

    expect(result.itemId).toBe(789)
    expect(result.typeItem).toBe('t')
    expect(result.itemStatus).toBe('owned')
  })

  it('falls back to DOM attributes when item is not in windowBandcampData', () => {
    handler.windowBandcampData = {
      type: 'collection',
      data: { collection: {}, wishlist: {} },
    }
    stubDocument('999', {
      'data-itemid': '999',
      'data-tralbumtype': 'a',
      'data-bandid': '11',
      'data-title': 'DOM Album',
      'artist': 'Test Band',
      'href': 'https://artist.bandcamp.com/album/dom-album',
      'src': 'https://img.example.com/art.jpg',
    }, 'collection-grid')

    const result = handler.gatherTrackInfo(999)

    expect(result.itemId).toBe(999)
    expect(result.typeItem).toBe('a')
    expect(result.itemStatus).toBe('owned')
    expect(result.title).toBe('DOM Album')
    expect(result.bandId).toBe(11)
    expect(result.albumUrl).toBe('https://artist.bandcamp.com/album/dom-album')
    expect(result.imageUrl).toBe('https://img.example.com/art.jpg')
  })

  it('returns a zeroed result when windowBandcampData is null and no DOM element matches', () => {
    handler.windowBandcampData = null
    stubDocument('')

    const result = handler.gatherTrackInfo(123)

    expect(result.itemId).toBe(0)
    expect(result.itemStatus).toBe('none')
    expect(result.title).toBe('')
  })
})

describe('bandcampDomHandler — gatherTrackInfo (album page path)', () => {
  let handler: BandcampDomHandler

  const baseLdJson: ReleaseLdJson = {
    '@type': 'MusicAlbum',
    '@id': 'https://artist.bandcamp.com/album/test',
    'name': 'My Album',
    'byArtist': { name: 'My Artist' },
    'image': 'https://img.example.com/cover.jpg',
  }

  beforeEach(() => {
    stubDocument('')
    // Construct with isAlbumPage=false so the constructor doesn't reach window.addEventListener.
    // Override the mock after construction — gatherTrackInfo reads it at call time.
    handler = new BandcampDomHandler()
    vi.mocked(pageDetection.isAlbumPage).mockReturnValue(true)
    handler.currentBlob = {
      album_id: 42,
      track_id: 0,
      fan_tralbum_data: { band_id: 99, is_purchased: false, is_wishlisted: false },
    } as any
    handler.currentApplicationLdJson = { ...baseLdJson }
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.mocked(pageDetection.isAlbumPage).mockReturnValue(false)
  })

  it('returns album data with status "none" when not purchased or wishlisted', () => {
    const result = handler.gatherTrackInfo()

    expect(result.itemId).toBe(42)
    expect(result.typeItem).toBe('a')
    expect(result.title).toBe('My Album')
    expect(result.artist).toBe('My Artist')
    expect(result.bandId).toBe(99)
    expect(result.albumUrl).toBe('https://artist.bandcamp.com/album/test')
    expect(result.imageUrl).toBe('https://img.example.com/cover.jpg')
    expect(result.itemStatus).toBe('none')
    expect(result.bcStreamData).toEqual({})
  })

  it('returns status "owned" when is_purchased is true', () => {
    handler.currentBlob = { album_id: 42, fan_tralbum_data: { band_id: 99, is_purchased: true } } as any

    const result = handler.gatherTrackInfo()

    expect(result.itemStatus).toBe('owned')
  })

  it('returns status "wishlisted" when is_wishlisted is true', () => {
    handler.currentBlob = { album_id: 42, fan_tralbum_data: { band_id: 99, is_wishlisted: true } } as any

    const result = handler.gatherTrackInfo()

    expect(result.itemStatus).toBe('wishlisted')
  })

  it('maps "@type": "MusicRecording" to typeItem "t" and uses track_id for itemId', () => {
    handler.currentBlob = { album_id: 0, track_id: 7, fan_tralbum_data: { band_id: 99 } } as any
    handler.currentApplicationLdJson = { ...baseLdJson, '@type': 'MusicRecording' }

    const result = handler.gatherTrackInfo()

    expect(result.typeItem).toBe('t')
    expect(result.itemId).toBe(7)
  })

  it('populates bcStreamData from windowBandcampData when type is tralbum', () => {
    handler.windowBandcampData = {
      type: 'tralbum',
      data: [{ id: 5, title: 'Track 1', track_num: 1, duration: 240, file: { 'mp3-128': 'https://stream.example.com/t.mp3' } }],
    } as any

    const result = handler.gatherTrackInfo()

    expect(result.bcStreamData).toMatchObject({ id: 5, title: 'Track 1', duration: 240 })
  })

  it('returns a zeroed result when currentBlob is null', () => {
    handler.currentBlob = null

    const result = handler.gatherTrackInfo()

    expect(result.itemId).toBe(0)
    expect(result.itemStatus).toBe('none')
    expect(result.title).toBe('')
  })

  it('returns a zeroed result when currentApplicationLdJson is null', () => {
    handler.currentApplicationLdJson = null

    const result = handler.gatherTrackInfo()

    expect(result.itemId).toBe(0)
    expect(result.itemStatus).toBe('none')
  })
})
