import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BaseHandler } from '../handlers/baseHandler'
import { StorageKeys } from '../shared/storageKeys'
import { makeMockDomHandler } from './helpers'

// Minimal concrete subclass — only BaseHandler logic is under test here
class TestHandler extends BaseHandler {
  hasLoadingConditions(): boolean { return true }
  async initStorageData(): Promise<void> {}
}

describe('baseHandler', () => {
  describe('checkRevisionAndBump', () => {
    let handler: TestHandler
    let loadSpy: ReturnType<typeof vi.spyOn>
    let saveSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      handler = new TestHandler(makeMockDomHandler())
      loadSpy = vi.spyOn(handler as any, 'loadFromStorage')
      saveSpy = vi.spyOn(handler as any, 'saveToStorage').mockResolvedValue(undefined)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('returns isStale=false when stored revision matches loadedRevision', async () => {
      loadSpy.mockResolvedValue({ watchedReleases: 100 })
      const { isStale } = await (handler as any).checkRevisionAndBump('watchedReleases', 100)
      expect(isStale).toBe(false)
    })

    it('returns isStale=true when stored revision differs from loadedRevision', async () => {
      loadSpy.mockResolvedValue({ watchedReleases: 999 })
      const { isStale } = await (handler as any).checkRevisionAndBump('watchedReleases', 100)
      expect(isStale).toBe(true)
    })

    it('returns isStale=true when field is absent from stored revisions (treats missing as 0)', async () => {
      loadSpy.mockResolvedValue({})
      const { isStale } = await (handler as any).checkRevisionAndBump('playlists', 1)
      expect(isStale).toBe(true)
    })

    it('returns isStale=false when both loadedRevision and stored field are 0', async () => {
      loadSpy.mockResolvedValue({})
      const { isStale } = await (handler as any).checkRevisionAndBump('playlists', 0)
      expect(isStale).toBe(false)
    })

    it('saves bumped revision and returns newRevision equal to Date.now()', async () => {
      loadSpy.mockResolvedValue({ watchedReleases: 100 })
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-15'))
      const expectedTs = new Date('2024-06-15').getTime()

      const { newRevision } = await (handler as any).checkRevisionAndBump('watchedReleases', 100)

      expect(newRevision).toBe(expectedTs)
      expect(saveSpy).toHaveBeenCalledWith(
        StorageKeys.storageRevisions,
        expect.objectContaining({ watchedReleases: expectedTs }),
      )
    })

    it('preserves other revision fields when bumping one field', async () => {
      loadSpy.mockResolvedValue({ playlists: 50, watchedArtists: 200 })

      await (handler as any).checkRevisionAndBump('watchedReleases', 0)

      const savedRevisions = saveSpy.mock.calls[0][1]
      expect(savedRevisions.playlists).toBe(50)
      expect(savedRevisions.watchedArtists).toBe(200)
    })
  })
})
