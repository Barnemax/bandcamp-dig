import type { BandcampCollectionItem, BandcampCollectionResponse } from '@barnemax/bandcamp-types'
import { BANDCAMP_COLLECTION_INITIAL_TOKEN, BANDCAMP_COLLECTION_URL } from '@barnemax/bandcamp-types'
import { fetchJson } from './utils'

export async function fetchFanCollection(fanId: number, collectionCount: number): Promise<BandcampCollectionResponse | null> {
  return fetchJson<BandcampCollectionResponse>(BANDCAMP_COLLECTION_URL, {
    count: collectionCount,
    fan_id: fanId,
    older_than_token: BANDCAMP_COLLECTION_INITIAL_TOKEN,
  })
}

export interface RankedArtist {
  band_id: number
  band_name: string
  band_url: string
  count: number
}

export function rankArtistsFromCollection(items: BandcampCollectionItem[]): RankedArtist[] {
  const map = new Map<string, RankedArtist>()

  for (const item of items) {
    const existing = map.get(item.band_url)
    if (existing) {
      existing.count++
    }
    else {
      map.set(item.band_url, {
        band_id: item.band_id,
        band_name: item.band_name,
        band_url: item.band_url,
        count: 1,
      })
    }
  }

  return [...map.values()].sort((a, b) => b.count - a.count)
}
