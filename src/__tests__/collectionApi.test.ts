import type { BandcampCollectionItem } from '@barnemax/bandcamp-types'
import { describe, expect, it } from 'vitest'
import { rankArtistsFromCollection } from '../shared/collectionApi'

function item(band_url: string, band_id: number, band_name: string): BandcampCollectionItem {
  return { band_url, band_id, band_name } as BandcampCollectionItem
}

describe('rankArtistsFromCollection', () => {
  it('returns empty array for empty input', () => {
    expect(rankArtistsFromCollection([])).toEqual([])
  })

  it('groups items by band_url and counts occurrences', () => {
    const items = [
      item('https://a.bandcamp.com', 1, 'Artist A'),
      item('https://a.bandcamp.com', 1, 'Artist A'),
      item('https://b.bandcamp.com', 2, 'Artist B'),
    ]
    const result = rankArtistsFromCollection(items)
    expect(result).toHaveLength(2)
    const a = result.find(r => r.band_url === 'https://a.bandcamp.com')
    const b = result.find(r => r.band_url === 'https://b.bandcamp.com')
    expect(a?.count).toBe(2)
    expect(a?.band_id).toBe(1)
    expect(a?.band_name).toBe('Artist A')
    expect(b?.count).toBe(1)
  })

  it('sorts by count descending', () => {
    const items = [
      item('https://a.bandcamp.com', 1, 'Artist A'),
      item('https://b.bandcamp.com', 2, 'Artist B'),
      item('https://b.bandcamp.com', 2, 'Artist B'),
      item('https://b.bandcamp.com', 2, 'Artist B'),
      item('https://c.bandcamp.com', 3, 'Artist C'),
      item('https://c.bandcamp.com', 3, 'Artist C'),
    ]
    const result = rankArtistsFromCollection(items)
    expect(result[0].band_url).toBe('https://b.bandcamp.com')
    expect(result[0].count).toBe(3)
    expect(result[1].band_url).toBe('https://c.bandcamp.com')
    expect(result[1].count).toBe(2)
    expect(result[2].band_url).toBe('https://a.bandcamp.com')
    expect(result[2].count).toBe(1)
  })

  it('handles single item', () => {
    const result = rankArtistsFromCollection([item('https://a.bandcamp.com', 1, 'Artist A')])
    expect(result).toHaveLength(1)
    expect(result[0].count).toBe(1)
  })
})
