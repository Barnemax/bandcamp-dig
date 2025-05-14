import { storage } from '#imports'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../shared/strings', () => ({
  strings: {
    t: (key: string): string => key,
  },
}))

const mockAlert = vi.fn()
const mockReload = vi.fn()
vi.stubGlobal('alert', mockAlert)
vi.stubGlobal('location', { reload: mockReload })

// Import after global stubs are registered
const { processImportData } = await import('../ui/dataMigrate')

describe('processImportData', () => {
  let setItemSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    setItemSpy = vi.spyOn(storage, 'setItem').mockResolvedValue(undefined)
    mockAlert.mockClear()
    mockReload.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('alerts and returns on invalid JSON', async () => {
    await processImportData('{not valid json')
    expect(mockAlert).toHaveBeenCalledWith('dataMigration.importError')
    expect(setItemSpy).not.toHaveBeenCalled()
  })

  it('alerts and returns when data is not an array', async () => {
    await processImportData(JSON.stringify({ key: 'value' }))
    expect(mockAlert).toHaveBeenCalledWith('dataMigration.importError')
    expect(setItemSpy).not.toHaveBeenCalled()
  })

  it('alerts and returns when entries are malformed (not [string, unknown] pairs)', async () => {
    await processImportData(JSON.stringify([['key'], ['a', 'b', 'c']]))
    expect(mockAlert).toHaveBeenCalledWith('dataMigration.importError')
    expect(setItemSpy).not.toHaveBeenCalled()
  })

  it('filters out unknown keys', async () => {
    const data = [
      ['local:watchedReleases', 'encodedstring'],
      ['local:unknownKey', 'encodedstring'],
    ]
    await processImportData(JSON.stringify(data))
    expect(setItemSpy).toHaveBeenCalledTimes(1)
    expect(setItemSpy).toHaveBeenCalledWith('local:watchedReleases', 'encodedstring')
  })

  it('accepts userSettings as a plain object', async () => {
    const data = [
      ['local:userSettings', { 'playlist/feature': true }],
    ]
    await processImportData(JSON.stringify(data))
    expect(setItemSpy).toHaveBeenCalledTimes(1)
    expect(setItemSpy).toHaveBeenCalledWith('local:userSettings', { 'playlist/feature': true })
  })

  it('rejects userSettings when value is a string instead of object', async () => {
    const data = [
      ['local:userSettings', 'should-be-object'],
    ]
    await processImportData(JSON.stringify(data))
    expect(setItemSpy).not.toHaveBeenCalled()
  })

  it('rejects non-userSettings keys when value is not a string', async () => {
    const data = [
      ['local:watchedReleases', { someObject: true }],
    ]
    await processImportData(JSON.stringify(data))
    expect(setItemSpy).not.toHaveBeenCalled()
  })

  it('writes all valid entries and reloads on success', async () => {
    const data = [
      ['local:watchedReleases', 'encoded1'],
      ['local:userPlaylists', 'encoded2'],
    ]
    await processImportData(JSON.stringify(data))
    expect(setItemSpy).toHaveBeenCalledTimes(2)
    expect(mockReload).toHaveBeenCalled()
  })
})
