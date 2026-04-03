import type { Settings } from '../shared/types'
import { storage } from '#imports'
import { StorageKeys } from '../shared/storageKeys'

export class DarkModeHandler {
  public isDarkModeApplied: boolean = false
  constructor() {
    this.applyDarkModePreference()
  }

  public async applyDarkModePreference(): Promise<void> {
    try {
      const userSettings: Settings | null = await storage.getItem(StorageKeys.userSettings)
      if (
        typeof userSettings === 'object'
        && userSettings !== null
        && StorageKeys.userSettingsDarkModePreferenceFeature in userSettings
        && (userSettings as Settings)[StorageKeys.userSettingsDarkModePreferenceFeature]
      ) {
        this.isDarkModeApplied = true
        document.documentElement.classList.add('dark-mode')

        // Add dark mode css file
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = browser.runtime.getURL('/dark-mode.css')
        document.head.appendChild(link)
      }
    }
    catch (error) {
      console.error('Error applying dark mode preference from storage', error)
    }
  }

  public updateMenuBarDarkMode(): void {
    // Inject style within menu-bar element (it's menu-bar tag, custom element)
    const menuBar = document.querySelector('menu-bar')
    if (menuBar) {
      const target: ShadowRoot | Element = (menuBar as HTMLElement).shadowRoot ?? menuBar

      if (!target.querySelector('#bcd-menubar-dark')) {
        const style = document.createElement('style')
        style.id = 'bcd-menubar-dark'
        style.textContent = `
          .menu-bar {
            background-color: var(--bcd-dm-bg) !important;

            .g-button .icon{
                color: var(--bcd-dm-text) !important;
            }

            .bandcamp-logo {
            --logo-fill-color: var(--bcd-dm-text) !important;
            }

            .icon.collection-outline-icon path {
                fill: var(--bcd-dm-text) !important;
            }
          }
        `
        target.appendChild(style)
      }
    }

    // We enable the body whether or not there is the menu bar (404 error for example)
    document.body.classList.add('header-loaded')
  }
}
