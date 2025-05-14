import type { BandcampDomHandler } from '../handlers/bandcampDomHandler'
import type { DailyCheckData } from '../shared/types'
import { storage } from '#imports'
import { EVENTS } from '../shared/events'
import { StorageKeys } from '../shared/storageKeys'
import { dispatchCustomEvent } from '../shared/utils'

export class CronTasks {
  public bandcampDomHandler: BandcampDomHandler

  constructor(bandcampDomHandler: BandcampDomHandler) {
    this.bandcampDomHandler = bandcampDomHandler
  }

  public async initStorageData(): Promise<void> {
    if (this.bandcampDomHandler.isOwnAccountPage() === false || this.bandcampDomHandler.isUserConnected() === false) {
      return // Not on account page, daily tasks not relevant
    }

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0]

    // Check if we already ran today
    const storedData = await storage.getItem<string>(StorageKeys.dailyCheck)
    if (storedData) {
      let parsed: DailyCheckData
      try {
        parsed = JSON.parse(storedData)
      }
      catch {
        // Corrupted storage — treat as never ran and fall through to run the daily task
        console.warn('BCD: failed to parse dailyCheck storage; treating as first run')
        parsed = { lastChecked: '' }
      }

      if (this.shouldRunDailyTask(parsed.lastChecked, today) === false) {
        dispatchCustomEvent(EVENTS.cronTasks.skippedDaily)
        return
      }
    }

    const initialData: DailyCheckData = {
      lastChecked: today,
    }

    await storage.setItem(StorageKeys.dailyCheck, JSON.stringify(initialData))
    dispatchCustomEvent(EVENTS.cronTasks.daily, { date: today })
  }

  public shouldRunDailyTask(lastChecked: string, today: string): boolean {
    return lastChecked !== today
  }
}
