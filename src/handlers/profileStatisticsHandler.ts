import type { ProfileStatistics, StatisticsRenderArgs } from '../shared/types'
import { DAILY_CHECK_TIMEOUT_MS } from '../shared/constants'
import { EVENTS } from '../shared/events'
import { StorageKeys } from '../shared/storageKeys'
import { BaseHandler } from './baseHandler'

export class ProfileStatisticsHandler extends BaseHandler {
  public userStats: Record<string, ProfileStatistics> = {}
  private dailyRegistrationResolve: (() => void) | null = null

  public hasLoadingConditions(): boolean {
    return this.bandcampDomHandler.isOwnAccountPage()
  }

  protected setupEventListeners(): void {
    this.onEvent(EVENTS.cronTasks.daily, async () => {
      await this.registerDailyStats()

      // Signal that registration is complete
      if (this.dailyRegistrationResolve) {
        this.dailyRegistrationResolve()
      }
    })

    this.onEvent(EVENTS.cronTasks.skippedDaily, () => {
      // Signal that we can proceed without registration
      if (this.dailyRegistrationResolve) {
        this.dailyRegistrationResolve()
      }
    })

    this.onEvent(EVENTS.profile.statistics.loaded, () => {
      this.renderUserStats()
    })
  }

  public async initStorageData(): Promise<void> {
    if (this.loadingConditionsMet === false) {
      return
    }

    const stats = await this.loadFromStorage<Record<string, ProfileStatistics>>(StorageKeys.userStats, {})

    // If no data, initialize
    if (Object.keys(stats).length === 0) {
      this.userStats = {}
      return
    }

    this.userStats = stats

    // Create a promise that will be resolved by either daily or skippedDaily event.
    // The 5 s timeout guards against the events never firing due to ordering issues.
    let timedOut = false
    const waitForDailyCheck = new Promise<void>((resolve) => {
      this.dailyRegistrationResolve = resolve
      setTimeout(() => {
        timedOut = true
        resolve()
      }, DAILY_CHECK_TIMEOUT_MS)
    })

    await waitForDailyCheck
    if (timedOut) {
      console.warn('[BCD] daily check timed out; rendering stats without confirmation')
    }

    this.dispatchEvent(EVENTS.profile.statistics.loaded, this.userStats)
  }

  private async saveUserStats(): Promise<void> {
    await this.saveToStorage(StorageKeys.userStats, this.userStats)
  }

  async registerDailyStats(): Promise<void> {
    const fanStats = this.bandcampDomHandler.currentBlob?.fan_stats

    if (!fanStats) {
      return
    }

    // ProfileStatistics: views -> numbers[0], timesPlayed -> numbers[1], followers -> followersCount
    const profileStatistics: ProfileStatistics = {
      views: fanStats.other_visits || 0,
      timesPlayed: fanStats.other_plays || 0,
      followers: this.bandcampDomHandler.currentBlob?.fan_data?.followers_count || 0,
    }

    const timestamp = new Date().toISOString().split('T')[0] // e.g., "2024-06-10"
    const key = `d${timestamp}`
    this.userStats[key] = profileStatistics

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 90)
    for (const k of Object.keys(this.userStats)) {
      if (new Date(k.replace(/^d/, '')) < cutoff) {
        delete this.userStats[k]
      }
    }

    await this.saveUserStats()
  }

  public renderUserStats(): void {
    this.bandcampDomHandler.renderUserStats(
      this.assembleStatisticsRenderArgs(),
    )
  }

  public assembleStatisticsRenderArgs(): StatisticsRenderArgs {
    let renderArgs: StatisticsRenderArgs = {
      evolution: {
        views: 0,
        timesPlayed: 0,
        followers: 0,
      },
      statisticsType: 'since',
    }

    const keys = Object.keys(this.userStats).sort() // dates in ascending order
    const parseDate = (str: string): Date => new Date(str.replace(/^d/, ''))

    // Find the cutoff date (7 days ago)
    const today = new Date()
    const cutoffDate = new Date(today)
    cutoffDate.setDate(today.getDate() - 7)

    // Filter entries from the last 7 calendar days
    const recentKeys = keys.filter(key => parseDate(key) >= cutoffDate)

    if (recentKeys.length >= 2) {
      const firstKey = recentKeys[0]
      const lastKey = recentKeys[recentKeys.length - 1]
      const first = this.userStats[firstKey]
      const last = this.userStats[lastKey]

      const evolution: ProfileStatistics = {
        views: last.views - first.views,
        timesPlayed: last.timesPlayed - first.timesPlayed,
        followers: last.followers - first.followers,
      }

      renderArgs = {
        evolution,
        statisticsType: 'last',
      }
    }

    // If there are no stats since that 7 days (ignoring today), register the difference between the two last recent records (the last record is today and the one previous to that one)
    else if (recentKeys.length === 1) {
      const todayKey = recentKeys[0]
      const todayStats = this.userStats[todayKey]

      // Find the most recent stats before today
      const previousKeys = keys.filter(key => parseDate(key) < parseDate(todayKey))
      if (previousKeys.length === 0) {
        return renderArgs // No previous data to compare
      }

      const previousKey = previousKeys[previousKeys.length - 1]
      const previousStats = this.userStats[previousKey]

      const evolution: ProfileStatistics = {
        views: todayStats.views - previousStats.views,
        timesPlayed: todayStats.timesPlayed - previousStats.timesPlayed,
        followers: todayStats.followers - previousStats.followers,
      }

      renderArgs = {
        evolution,
        statisticsType: 'since',
        lastRecordDate: previousKey.replace(/^d/, ''),
      }
    }

    return renderArgs
  }
}
