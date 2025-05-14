import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  decodeFromLocalStorage,
  encodeForLocalStorage,
  toKey,
} from '../storage/storageCodec'

describe('storageCodec', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => { })
    vi.spyOn(console, 'error').mockImplementation(() => { })
  })

  describe('compress/decompress', () => {
    it('should round-trip simple objects', () => {
      const data = { name: 'test', count: 42 }
      expect(decodeFromLocalStorage(encodeForLocalStorage(data))).toEqual(data)
    })

    it('should round-trip arrays', () => {
      const data = [1, 2, 3, { nested: true }]
      expect(decodeFromLocalStorage(encodeForLocalStorage(data))).toEqual(data)
    })

    it('should round-trip nested objects', () => {
      const data = {
        playlists: [
          { id: 1, name: 'Favorites', tracks: ['a', 'b', 'c'] },
          { id: 2, name: 'To Listen', tracks: [] },
        ],
        settings: { darkMode: true, volume: 0.8 },
      }
      expect(decodeFromLocalStorage(encodeForLocalStorage(data))).toEqual(data)
    })

    it('should handle empty objects', () => {
      const data = {}
      expect(decodeFromLocalStorage(encodeForLocalStorage(data))).toEqual(data)
    })

    it('should handle empty arrays', () => {
      const data: unknown[] = []
      expect(decodeFromLocalStorage(encodeForLocalStorage(data))).toEqual(data)
    })

    it('should handle strings with special characters', () => {
      const data = { text: 'Hello, 世界! 🎵 <script>alert("xss")</script>' }
      expect(decodeFromLocalStorage(encodeForLocalStorage(data))).toEqual(data)
    })

    it('should return null for non-string input', () => {
      expect(decodeFromLocalStorage(123 as unknown as string)).toBeNull()
      expect(decodeFromLocalStorage(null as unknown as string)).toBeNull()
      expect(decodeFromLocalStorage(undefined as unknown as string)).toBeNull()
      expect(decodeFromLocalStorage({} as unknown as string)).toBeNull()
    })

    it('should actually compress data (output smaller than input for large data)', () => {
      const largeData = {
        items: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          description: 'This is a repeated description that should compress well',
        })),
      }
      const encoded = encodeForLocalStorage(largeData)
      const originalSize = JSON.stringify(largeData).length
      expect(encoded.length).toBeLessThan(originalSize)
    })
  })

  describe('encodeForLocalStorage/decodeFromLocalStorage', () => {
    it('should encode and decode data for localStorage', () => {
      const data = { playlists: ['rock', 'jazz'], count: 5 }
      const encoded = encodeForLocalStorage(data)
      const decoded = decodeFromLocalStorage<typeof data>(encoded)
      expect(decoded).toEqual(data)
    })

    it('should return null for empty string', () => {
      expect(decodeFromLocalStorage('')).toBeNull()
    })

    it('should return null for invalid compressed data', () => {
      const result = decodeFromLocalStorage('not-valid-base64-compressed-data!')
      expect(result).toBeNull()
    })

    it('should handle typed decoding', () => {
      interface Playlist {
        id: number
        name: string
      }
      const data: Playlist = { id: 1, name: 'Test' }
      const encoded = encodeForLocalStorage(data)
      const decoded = decodeFromLocalStorage<Playlist>(encoded)
      expect(decoded?.id).toBe(1)
      expect(decoded?.name).toBe('Test')
    })
  })

  describe('toKey', () => {
    it('should create prefixed keys', () => {
      expect(toKey(42)).toBe('i42')
      expect(toKey(0)).toBe('i0')
      expect(toKey(999999)).toBe('i999999')
    })
  })
})
