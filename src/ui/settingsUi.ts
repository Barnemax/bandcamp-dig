import type { Settings } from '../shared/types'
import { storage } from '#imports'
import { DEFAULT_SETTINGS, StorageKeys } from '../shared/storageKeys'

interface CheckboxConfig {
  settingKey: string
  label: string
  defaultValue?: boolean
  container?: HTMLElement
}

export async function createSettingCheckbox({ settingKey, label, defaultValue = false, container }: CheckboxConfig): Promise<HTMLElement> {
  // Get stored value or use default
  const checkedValue = await getSettingValue(settingKey)
  const checked = typeof checkedValue === 'boolean' ? checkedValue : defaultValue

  // Create the toggle wrapper
  const wrapper = document.createElement('label')
  wrapper.classList.add('toggle-switch')

  // Create the checkbox input
  const checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.checked = checked
  checkbox.setAttribute('data-setting-key', settingKey)

  // Create the toggle slider
  const slider = document.createElement('span')
  slider.classList.add('toggle-slider')

  // Create the label text
  const labelText = document.createElement('span')
  labelText.classList.add('toggle-label')
  labelText.textContent = label

  // Handle checkbox change
  checkbox.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement
    const isChecked = target.checked

    // Save to localStorage
    setSettingValue(settingKey, isChecked)
  })

  // Assemble the elements
  wrapper.appendChild(checkbox)
  wrapper.appendChild(slider)
  wrapper.appendChild(labelText)

  // Append to container if provided
  if (container) {
    container.appendChild(wrapper)
  }

  return wrapper
}

// Convenience function to create and append multiple checkboxes
export async function registerSettingCheckboxes(configs: CheckboxConfig[], container: HTMLElement): Promise<HTMLElement[]> {
  const checkboxes = await Promise.all(configs.map(config => createSettingCheckbox({ ...config, container })))

  return checkboxes
}

// Helper function to get a setting value
export async function getSettingValue(key: string): Promise<boolean> {
  const stored = await storage.getItem(StorageKeys.userSettings)

  let settings: Settings

  if (typeof stored === 'object' && stored !== null) {
    settings = stored as Settings
  }
  else {
    settings = {}
  }

  const defaultValue = DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS] ?? true

  return settings[key] ?? defaultValue
}

// Helper function to set a setting value programmatically
export async function setSettingValue(key: string, value: boolean): Promise<void> {
  const stored = await storage.getItem(StorageKeys.userSettings)

  const settings: Settings = (typeof stored === 'object' && stored !== null)
    ? stored as Settings
    : {}

  settings[key] = value

  await storage.setItem(StorageKeys.userSettings, settings)
}
