import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CronTasks } from '../services/cronTasks'

vi.mock('../handlers/bandcampDomHandler', () => ({
  BandcampDomHandler: class {
    isOwnAccountPage(): boolean {
      return true
    }
  },
}))

describe('cronTasks', () => {
  describe('dailyCronTask', () => {
    let cronTasks: CronTasks

    beforeEach(() => {
      cronTasks = new CronTasks({} as any)
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-15'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    describe('should return true if lastChecked !== today', () => {
      it('when lastChecked is in the past', () => {
        const result = cronTasks.shouldRunDailyTask('2024-06-14', '2024-06-15')
        expect(result).toBe(true)
      })
    })

    describe('should return false if lastChecked === today', () => {
      it('when lastChecked is today', () => {
        const result = cronTasks.shouldRunDailyTask('2024-06-15', '2024-06-15')
        expect(result).toBe(false)
      })
    })

    describe('corrupted storage recovery', () => {
      it('returns true when lastChecked is empty string (JSON parse fallback)', () => {
        // When stored JSON is corrupted, initStorageData falls back to { lastChecked: '' }
        const result = cronTasks.shouldRunDailyTask('', '2024-06-15')
        expect(result).toBe(true)
      })
    })
  })
})
