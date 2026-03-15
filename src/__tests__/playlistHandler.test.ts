import type { ItemData, PlaylistData } from '../shared/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PlaylistHandler } from '../handlers/playlistHandler'
import { fetchDocument } from '../shared/utils'
import { makeMockDomHandler } from './helpers'

vi.mock('../shared/utils', () => ({
  fetchDocument: vi.fn(),
}))

function createPlaylist(overrides?: Partial<PlaylistData>): PlaylistData {
  return {
    playlistId: 1,
    title: 'Test Playlist',
    tracks: {},
    lastUpdated: Date.now(),
    ...overrides,
  }
}

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

describe('playlistHandler', () => {
  describe('itemStatusUpdate', () => {
    let handler: PlaylistHandler
    beforeEach(() => {
      handler = new PlaylistHandler(makeMockDomHandler())
    })

    it('should update item status in playlist that contains the item', () => {
      handler.userPlaylists = [
        createPlaylist({ tracks: { 123: { itemId: 123, itemStatus: 'none' } as ItemData } }),
      ]

      handler.updateItemStatusInPlaylists(123, 'owned')
      expect(handler.userPlaylists[0].tracks[123].itemStatus).toBe('owned')
    })
  })

  describe('fetchItemStatus', () => {
    let handler: PlaylistHandler
    beforeEach(() => {
      handler = new PlaylistHandler(makeMockDomHandler())
      vi.mocked(fetchDocument).mockReset()
    })

    function mockDoc(pageDataJson: string | null): { querySelector: (sel: string) => { getAttribute: () => string } | null } {
      return {
        querySelector: (sel: string): { getAttribute: () => string } | null => {
          if (sel === '#pagedata') {
            return pageDataJson !== null ? { getAttribute: (): string => pageDataJson } : null
          }
          return null
        },
      }
    }

    it('returns null when fetchDocument returns null', async () => {
      vi.mocked(fetchDocument).mockResolvedValueOnce(false)
      expect(await handler.fetchItemStatus('https://example.com')).toBeNull()
    })

    it('returns null when page data JSON is malformed', async () => {
      vi.mocked(fetchDocument).mockResolvedValueOnce(mockDoc('{invalid') as any)
      expect(await handler.fetchItemStatus('https://example.com')).toBeNull()
    })

    it('returns "owned" when is_purchased is true', async () => {
      const json = JSON.stringify({ fan_tralbum_data: { is_purchased: true } })
      vi.mocked(fetchDocument).mockResolvedValueOnce(mockDoc(json) as any)
      expect(await handler.fetchItemStatus('https://example.com')).toBe('owned')
    })

    it('returns "wishlisted" when is_wishlisted is true', async () => {
      const json = JSON.stringify({ fan_tralbum_data: { is_wishlisted: true } })
      vi.mocked(fetchDocument).mockResolvedValueOnce(mockDoc(json) as any)
      expect(await handler.fetchItemStatus('https://example.com')).toBe('wishlisted')
    })

    it('returns null when fan_tralbum_data is absent', async () => {
      const json = JSON.stringify({ other_data: {} })
      vi.mocked(fetchDocument).mockResolvedValueOnce(mockDoc(json) as any)
      expect(await handler.fetchItemStatus('https://example.com')).toBeNull()
    })
  })
})
