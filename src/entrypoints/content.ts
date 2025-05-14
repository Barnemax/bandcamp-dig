import type { Settings } from '../shared/types'
import { storage } from '#imports'
import { ArtistWatchHandler } from '../handlers/artistWatchHandler'
import { DarkModeHandler } from '../handlers/darkModeHandler'
import { NewReleaseHandler } from '../handlers/newReleaseHandler'
import { PlaylistHandler } from '../handlers/playlistHandler'
import { ProfileStatisticsHandler } from '../handlers/profileStatisticsHandler'
import { CronTasks } from '../services/cronTasks'
import { shouldLoadExtensionFeatures } from '../shared/pageDetection'
import { DEFAULT_SETTINGS, StorageKeys } from '../shared/storageKeys'

export default defineContentScript({
  matches: ['*://*.bandcamp.com/*'],
  runAt: 'document_start',
  main() {
    // Apply dark mode as early as possible
    const darkModeHandler = new DarkModeHandler()

    window.addEventListener('load', async () => {
      // Maybe apply dark mode to menu bar after load (it's a shadow DOM element)
      if (darkModeHandler.isDarkModeApplied) {
        darkModeHandler.updateMenuBarDarkMode()
      }

      if (shouldLoadExtensionFeatures() === false) {
        return
      }

      const { BandcampDomHandler } = await import('../handlers/bandcampDomHandler')

      const stored = await storage.getItem(StorageKeys.userSettings)

      let userSettings: Settings

      if (typeof stored !== 'object' || stored === null) {
        userSettings = { ...DEFAULT_SETTINGS }
      }
      else {
        // Merge stored settings with defaults, prioritizing stored values
        userSettings = {
          ...DEFAULT_SETTINGS,
          ...(stored as Settings),
        }
      }

      const bandcampDomHandler = new BandcampDomHandler()
      const cronTasks = new CronTasks(bandcampDomHandler)

      let profileStatisticsHandlerInstance = null
      let playlistHandler = null
      let newReleaseHandler = null
      let artistWatchHandler = null

      if (userSettings[StorageKeys.userSettingsProfileStatisticsFeature]) {
        profileStatisticsHandlerInstance = new ProfileStatisticsHandler(bandcampDomHandler)
      }

      if (userSettings[StorageKeys.userSettingsPlaylistFeature]) {
        playlistHandler = new PlaylistHandler(bandcampDomHandler)
      }

      if (userSettings[StorageKeys.userSettingsNewReleaseFeature]) {
        newReleaseHandler = new NewReleaseHandler(bandcampDomHandler)
        artistWatchHandler = new ArtistWatchHandler(bandcampDomHandler)
      }

      const handlers = [
        playlistHandler,
        newReleaseHandler,
        artistWatchHandler,
        profileStatisticsHandlerInstance,
        cronTasks,
      ].filter(handler => handler !== null) // Remove any null handlers

      const results = await Promise.allSettled(
        handlers
          .filter(handler => typeof handler.initStorageData === 'function')
          .map(handler => handler.initStorageData()),
      )

      for (const result of results) {
        if (result.status === 'rejected') {
          console.error('BCD: a handler failed to initialize:', result.reason)
        }
      }

      // Now storage is ready and listeners are attached
      bandcampDomHandler.start()
    })
  },
})
