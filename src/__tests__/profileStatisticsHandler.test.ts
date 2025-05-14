import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfileStatisticsHandler } from '../handlers/profileStatisticsHandler'
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
  },
}))

describe('profileStatisticsHandler', () => {
  describe('assembleStatisticsRenderArgs', () => {
    let handler: ProfileStatisticsHandler

    beforeEach(() => {
      handler = new ProfileStatisticsHandler(makeMockDomHandler())
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-15'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should return default values when no stats exist', () => {
      handler.userStats = {}

      const result = handler.assembleStatisticsRenderArgs()

      expect(result).toEqual({
        evolution: { views: 0, timesPlayed: 0, followers: 0 },
        statisticsType: 'since',
      })
    })

    it('should calculate evolution for 2+ entries within last 7 days', () => {
      handler.userStats = {
        'd2024-06-10': { views: 100, timesPlayed: 50, followers: 10 },
        'd2024-06-12': { views: 120, timesPlayed: 60, followers: 12 },
        'd2024-06-15': { views: 150, timesPlayed: 80, followers: 15 },
      }

      const result = handler.assembleStatisticsRenderArgs()

      expect(result).toEqual({
        evolution: { views: 50, timesPlayed: 30, followers: 5 },
        statisticsType: 'last',
      })
    })

    it('should compare with previous record when only 1 entry in last 7 days', () => {
      handler.userStats = {
        'd2024-05-01': { views: 80, timesPlayed: 40, followers: 8 },
        'd2024-06-15': { views: 150, timesPlayed: 80, followers: 15 },
      }

      const result = handler.assembleStatisticsRenderArgs()

      expect(result).toEqual({
        evolution: { views: 70, timesPlayed: 40, followers: 7 },
        statisticsType: 'since',
        lastRecordDate: '2024-05-01',
      })
    })

    it('should return default when only today exists with no previous data', () => {
      handler.userStats = {
        'd2024-06-15': { views: 150, timesPlayed: 80, followers: 15 },
      }

      const result = handler.assembleStatisticsRenderArgs()

      expect(result).toEqual({
        evolution: { views: 0, timesPlayed: 0, followers: 0 },
        statisticsType: 'since',
      })
    })

    it('should handle negative evolution (stats decreased)', () => {
      handler.userStats = {
        'd2024-06-10': { views: 100, timesPlayed: 50, followers: 20 },
        'd2024-06-15': { views: 90, timesPlayed: 45, followers: 18 },
      }

      const result = handler.assembleStatisticsRenderArgs()

      expect(result).toEqual({
        evolution: { views: -10, timesPlayed: -5, followers: -2 },
        statisticsType: 'last',
      })
    })

    it('should use first and last keys when multiple entries exist in 7 days', () => {
      handler.userStats = {
        'd2024-06-09': { views: 50, timesPlayed: 25, followers: 5 },
        'd2024-06-11': { views: 75, timesPlayed: 35, followers: 7 },
        'd2024-06-13': { views: 100, timesPlayed: 50, followers: 10 },
        'd2024-06-15': { views: 130, timesPlayed: 70, followers: 14 },
      }

      const result = handler.assembleStatisticsRenderArgs()

      // Should compare d2024-06-09 (first in range) with d2024-06-15 (last)
      expect(result).toEqual({
        evolution: { views: 80, timesPlayed: 45, followers: 9 },
        statisticsType: 'last',
      })
    })
  })

  describe('registerDailyStats — 90-day pruning', () => {
    let handler: ProfileStatisticsHandler

    beforeEach(() => {
      handler = new ProfileStatisticsHandler(makeMockDomHandler())
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-15'))
      // today=2024-06-15, cutoff = 2024-03-17 (90 days back)
      ;(handler as any).bandcampDomHandler = {
        currentBlob: {
          fan_stats: { other_visits: 200, other_plays: 100 },
          fan_data: { followers_count: 20 },
        },
      }
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('removes entries older than 90 days and keeps recent ones', async () => {
      handler.userStats = {
        'd2023-12-01': { views: 10, timesPlayed: 5, followers: 1 }, // clearly >90 days old
        'd2024-01-15': { views: 30, timesPlayed: 15, followers: 3 }, // clearly >90 days old
        'd2024-05-01': { views: 120, timesPlayed: 60, followers: 12 }, // clearly within 90 days
        'd2024-06-10': { views: 150, timesPlayed: 70, followers: 15 }, // clearly within 90 days
      }

      await (handler as any).registerDailyStats()

      expect(handler.userStats['d2023-12-01']).toBeUndefined()
      expect(handler.userStats['d2024-01-15']).toBeUndefined()
      expect(handler.userStats['d2024-05-01']).toBeDefined()
      expect(handler.userStats['d2024-06-10']).toBeDefined()
      expect(handler.userStats['d2024-06-15']).toBeDefined()
    })

    it('keeps all entries when none are older than 90 days', async () => {
      handler.userStats = {
        'd2024-04-01': { views: 100, timesPlayed: 50, followers: 10 },
        'd2024-06-01': { views: 150, timesPlayed: 70, followers: 15 },
      }

      await (handler as any).registerDailyStats()

      expect(handler.userStats['d2024-04-01']).toBeDefined()
      expect(handler.userStats['d2024-06-01']).toBeDefined()
      expect(handler.userStats['d2024-06-15']).toBeDefined()
    })
  })
})
