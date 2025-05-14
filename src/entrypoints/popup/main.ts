import { storage } from '#imports'
import { GLOBAL } from '@/shared/global'
import { DEFAULT_SETTINGS, StorageKeys } from '@/shared/storageKeys'
import { strings } from '@/shared/strings'
import { isFirefox } from '@/shared/utils'
import { exportButton, importButton } from '@/ui/dataMigrate'
import { registerSettingCheckboxes } from '@/ui/settingsUi'
import './style.scss'
import bcdLogo from '/icon.svg'

// Initialize the popup based on user state
async function initPopup(): Promise<void> {
  const userSettings = await storage.getItem(StorageKeys.userSettings)
  const isFirstTime = !userSettings

  if (isFirstTime) {
    showWelcomeScreen()
  }
  else {
    showMainPopup()
  }
}

function showWelcomeScreen(): void {
  document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
    <div class="welcome-screen">
      <a href="https://wxt.dev" target="_blank">
        <img src="${bcdLogo}" class="logo" alt="BCD logo" />
      </a>
      <h1>${strings.t('popup.title')}</h1>
      <div class="welcome-content">
        <ul>
          <li>${strings.t('welcome.featurePlaylist')}</li>
          <li>${strings.t('welcome.featureReleases')}</li>
          <li>${strings.t('welcome.featureStats')}</li>
          <li>${strings.t('welcome.featureDarkMode')}</li>
        </ul>
        <button id="get-started-btn" class="primary-btn">${strings.t('welcome.getStarted')}</button>
      </div>
    </div>
  `

  // Handle Get Started button click
  document.getElementById('get-started-btn')?.addEventListener('click', async () => {
    // Initialize settings with default values
    await storage.setItem(StorageKeys.userSettings, DEFAULT_SETTINGS)

    // Switch to main popup
    showMainPopup()
  })
}

function showMainPopup(): void {
  const linksMap = [
    { label: strings.t('popup.donate'), url: GLOBAL.dev.paypal },
    { label: strings.t('popup.github'), url: GLOBAL.dev.github.repo },
    { label: strings.t('popup.featureRequest'), url: GLOBAL.dev.github.report },
    { label: strings.t('popup.rateExtension'), url: isFirefox() ? GLOBAL.dev.rateLink.firefox : GLOBAL.dev.rateLink.chrome },
  ]

  document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
    <div class="popup-container">
      <section class="header">
        <a href="https://wxt.dev" target="_blank">
          <img src="${bcdLogo}" class="logo" alt="BCD logo" />
        </a>
        <h1>${strings.t('popup.title')}</h1>
      </section>

      <section class="settings-container">
        <h2>${strings.t('popup.features')}</h2>
      </section>

      <section class="migrate-container">
        <h2>${strings.t('popup.dataMigration')}</h2>
        <ul>
          <li><button class="btn-like export-data-btn">${strings.t('popup.export')}</button></li>
          <li><button class="btn-like import-data-btn">${strings.t('popup.import')}</button></li>
        </ul>
      </section>

      <section class="dev-links-container">
        <h2>${strings.t('popup.links')}</h2>
        <ul>
          ${linksMap.map(link => `<li><a class="btn-like" href="${link.url}" target="_blank" rel="noopener noreferrer">${link.label}</a></li>`).join('')}
        </ul>
      </section>
    </div>
  `

  const settingsContainer = document.querySelector('.settings-container')!
  registerSettingCheckboxes([
    {
      settingKey: StorageKeys.userSettingsPlaylistFeature,
      label: strings.t('settings.playlistManager'),
      defaultValue: true,
      container: settingsContainer as HTMLElement,
    },
    {
      settingKey: StorageKeys.userSettingsNewReleaseFeature,
      label: strings.t('settings.newReleases'),
      defaultValue: true,
      container: settingsContainer as HTMLElement,
    },
    {
      settingKey: StorageKeys.userSettingsProfileStatisticsFeature,
      label: strings.t('settings.profileStats'),
      defaultValue: true,
      container: settingsContainer as HTMLElement,
    },
    {
      settingKey: StorageKeys.userSettingsDarkModePreferenceFeature,
      label: strings.t('settings.darkMode'),
      defaultValue: false,
      container: settingsContainer as HTMLElement,
    },
  ], settingsContainer as HTMLElement)

  const exportContainer = document.querySelector('.migrate-container') as HTMLElement
  exportButton(exportContainer)
  importButton(exportContainer)
}

// Start the popup
initPopup()
