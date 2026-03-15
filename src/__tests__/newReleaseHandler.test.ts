import type { NewReleaseData } from '../shared/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NewReleaseHandler } from '../handlers/newReleaseHandler'
import { makeMockDomHandler } from './helpers'

// Mock the dependencies
vi.mock('../handlers/baseHandler', () => ({
  BaseHandler: class {
    loadingConditionsMet = true
    bandcampDomHandler = { isOwnAccountPage: (): boolean => true }
    onEvent(): void { }
    dispatchEvent(): void { }
    loadFromStorage(): any { return {} }
    saveToStorage(): Promise<void> { return Promise.resolve() }
    loadRevisions(): Promise<object> { return Promise.resolve({}) }
    checkRevisionAndBump(): Promise<{ isStale: boolean, newRevision: number }> {
      return Promise.resolve({ isStale: false, newRevision: Date.now() })
    }
  },
}))

function baseRelease(overrides: Partial<NewReleaseData> = {}): NewReleaseData {
  return {
    itemId: 1,
    typeItem: 'a',
    bandId: 10,
    title: 'Test Album',
    artist: 'Test Artist',
    albumUrl: 'https://example.bandcamp.com/album/test',
    imageUrl: 'https://example.com/cover.jpg',
    releaseDate: 0,
    isReleased: false,
    bcStreamData: {},
    addedAt: Date.now(),
    itemStatus: 'none',
    ...overrides,
  }
}

describe('newReleaseHandler', () => {
  describe('checkForReleasedInWatchedReleases', () => {
    let handler: NewReleaseHandler

    beforeEach(() => {
      handler = new NewReleaseHandler(makeMockDomHandler())
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-15'))
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('should identify newly released items correctly', async () => {
      handler.watchedReleases = {
        album1: { title: 'Album One', artist: 'Artist A', typeItem: 'a', itemId: 12345, albumUrl: 'https://example.com/album1', imageUrl: 'https://example.com/album1.jpg', bandId: 1, bcStreamData: {}, addedAt: new Date('2024-06-05').getTime(), itemStatus: 'none', releaseDate: new Date('2024-06-10').getTime(), isReleased: false },
        album2: { title: 'Album Two', artist: 'Artist B', typeItem: 'a', itemId: 12346, albumUrl: 'https://example.com/album2', imageUrl: 'https://example.com/album2.jpg', bandId: 2, bcStreamData: {}, addedAt: new Date('2024-06-10').getTime(), itemStatus: 'none', releaseDate: new Date('2024-06-14').getTime(), isReleased: false },
        album3: { title: 'Album Three', artist: 'Artist C', typeItem: 'a', itemId: 12347, albumUrl: 'https://example.com/album3', imageUrl: 'https://example.com/album3.jpg', bandId: 3, bcStreamData: {}, addedAt: new Date('2024-05-25').getTime(), itemStatus: 'none', releaseDate: new Date('2024-07-01').getTime(), isReleased: false },
      }

      await handler.checkForReleasedInWatchedReleases()

      const releasedItems = Object.values(handler.watchedReleases).filter(item => item.isReleased)
      expect(releasedItems).toHaveLength(2)
      expect(releasedItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ itemId: 12345 }),
          expect.objectContaining({ itemId: 12346 }),
        ]),
      )
    })

    it('should mark no items as released if all release dates are in the future', async () => {
      handler.watchedReleases = {
        album1: { title: 'Album One', artist: 'Artist A', typeItem: 'a', itemId: 12345, albumUrl: 'https://example.com/album1', imageUrl: 'https://example.com/album1.jpg', bandId: 1, bcStreamData: {}, addedAt: new Date('2024-06-05').getTime(), itemStatus: 'none', releaseDate: new Date('2024-06-20').getTime(), isReleased: false },
        album2: { title: 'Album Two', artist: 'Artist B', typeItem: 'a', itemId: 12346, albumUrl: 'https://example.com/album2', imageUrl: 'https://example.com/album2.jpg', bandId: 2, bcStreamData: {}, addedAt: new Date('2024-06-10').getTime(), itemStatus: 'none', releaseDate: new Date('2024-06-25').getTime(), isReleased: false },
      }

      await handler.checkForReleasedInWatchedReleases()

      const releasedItems = Object.values(handler.watchedReleases).filter(item => item.isReleased)
      expect(releasedItems).toHaveLength(0)
    })
  })

  describe('splitWatchedReleases', () => {
    let handler: NewReleaseHandler

    beforeEach(() => {
      handler = new NewReleaseHandler(makeMockDomHandler())
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-15'))
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('separates past releases from upcoming ones', () => {
      handler.watchedReleases = {
        i1: baseRelease({ itemId: 1, releaseDate: new Date('2024-06-10').getTime(), isReleased: false }),
        i2: baseRelease({ itemId: 2, releaseDate: new Date('2024-07-01').getTime(), isReleased: false }),
      }
      const { released, upcoming } = (handler as any).splitWatchedReleases()
      expect(released).toHaveLength(1)
      expect(released[0].itemId).toBe(1)
      expect(upcoming).toHaveLength(1)
      expect(upcoming[0].itemId).toBe(2)
    })

    it('includes items flagged isReleased=true even when releaseDate is in the future', () => {
      handler.watchedReleases = {
        i1: baseRelease({ itemId: 1, releaseDate: new Date('2024-07-01').getTime(), isReleased: true }),
      }
      const { released, upcoming } = (handler as any).splitWatchedReleases()
      expect(released).toHaveLength(1)
      expect(upcoming).toHaveLength(0)
    })

    it('puts items with releaseDate=0 in upcoming', () => {
      handler.watchedReleases = {
        i1: baseRelease({ itemId: 1, releaseDate: 0, isReleased: false }),
      }
      const { released, upcoming } = (handler as any).splitWatchedReleases()
      expect(released).toHaveLength(0)
      expect(upcoming).toHaveLength(1)
    })

    it('returns empty lists when watchedReleases is empty', () => {
      handler.watchedReleases = {}
      const { released, upcoming } = (handler as any).splitWatchedReleases()
      expect(released).toHaveLength(0)
      expect(upcoming).toHaveLength(0)
    })
  })

  describe('buildReleaseFromLdJson', () => {
    let handler: NewReleaseHandler

    beforeEach(() => {
      handler = new NewReleaseHandler(makeMockDomHandler())
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-15'))
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('maps blob and ldJson fields to NewReleaseData', () => {
      const blob = { album_id: 42, track_id: 0, fan_tralbum_data: { band_id: 99 } }
      const ldJson = {
        '@type': 'MusicAlbum',
        '@id': 'https://example.bandcamp.com/album/test',
        'name': 'Test Album',
        'datePublished': '2024-06-10',
        'byArtist': { name: 'Test Artist' },
        'image': 'https://example.com/cover.jpg',
      }
      const result = (handler as any).buildReleaseFromLdJson(blob, ldJson)
      expect(result.itemId).toBe(42)
      expect(result.typeItem).toBe('a')
      expect(result.bandId).toBe(99)
      expect(result.title).toBe('Test Album')
      expect(result.artist).toBe('Test Artist')
      expect(result.albumUrl).toBe('https://example.bandcamp.com/album/test')
      expect(result.imageUrl).toBe('https://example.com/cover.jpg')
      expect(result.isReleased).toBe(true)
      expect(result.itemStatus).toBe('none')
    })

    it('sets typeItem to "t" for non-MusicAlbum types', () => {
      const blob = { album_id: 0, track_id: 5, fan_tralbum_data: { band_id: 0 } }
      const ldJson = { '@type': 'MusicRecording', '@id': '', 'name': '' }
      const result = (handler as any).buildReleaseFromLdJson(blob, ldJson)
      expect(result.typeItem).toBe('t')
      expect(result.itemId).toBe(5)
    })

    it('marks isReleased=false when datePublished is in the future', () => {
      const blob = { album_id: 1, track_id: 0, fan_tralbum_data: { band_id: 0 } }
      const ldJson = { '@type': 'MusicAlbum', '@id': '', 'name': '', 'datePublished': '2024-12-01' }
      const result = (handler as any).buildReleaseFromLdJson(blob, ldJson)
      expect(result.isReleased).toBe(false)
    })

    it('sets releaseDate=0 and isReleased=false when datePublished is absent', () => {
      const blob = { album_id: 1, track_id: 0, fan_tralbum_data: { band_id: 0 } }
      const ldJson = { '@type': 'MusicAlbum', '@id': '', 'name': '' }
      const result = (handler as any).buildReleaseFromLdJson(blob, ldJson)
      expect(result.releaseDate).toBe(0)
      expect(result.isReleased).toBe(false)
    })
  })

  describe('buildReleaseFromDomItem', () => {
    let handler: NewReleaseHandler

    beforeEach(() => {
      handler = new NewReleaseHandler(makeMockDomHandler())
    })

    it('extracts release data from DOM attributes and child elements', () => {
      const attrs: Record<string, string> = {
        'data-tralbumtype': 'a',
        'data-bandid': '7',
        'data-title': 'DOM Album',
      }
      const mockItem = {
        getAttribute: (attr: string): string | null => attrs[attr] ?? null,
        querySelector: (sel: string): { textContent?: string, getAttribute?: (a: string) => string | null } | null => {
          if (sel === '.collection-item-artist') {
            return { textContent: 'DOM Artist' }
          }
          if (sel === '.collection-item-art-container a') {
            return { getAttribute: (): string => 'https://example.com/album' }
          }
          if (sel === '.collection-item-art img') {
            return { getAttribute: (): string => 'https://example.com/img.jpg' }
          }
          return null
        },
      } as unknown as HTMLElement

      const result = (handler as any).buildReleaseFromDomItem(mockItem, 99, 1718000000000)
      expect(result.itemId).toBe(99)
      expect(result.typeItem).toBe('a')
      expect(result.bandId).toBe(7)
      expect(result.title).toBe('DOM Album')
      expect(result.artist).toBe('DOM Artist')
      expect(result.albumUrl).toBe('https://example.com/album')
      expect(result.imageUrl).toBe('https://example.com/img.jpg')
      expect(result.releaseDate).toBe(1718000000000)
      expect(result.isReleased).toBe(false)
      expect(result.itemStatus).toBe('none')
    })

    it('defaults typeItem to "t" for non-"a" tralbumtype', () => {
      const mockItem = {
        getAttribute: (attr: string): string | null => attr === 'data-tralbumtype' ? 't' : null,
        querySelector: (): null => null,
      } as unknown as HTMLElement
      const result = (handler as any).buildReleaseFromDomItem(mockItem, 1, 0)
      expect(result.typeItem).toBe('t')
    })
  })
})
