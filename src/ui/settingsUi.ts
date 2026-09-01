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
  const checkedValue = await getSettingValue(settingKey)
  const checked = typeof checkedValue === 'boolean' ? checkedValue : defaultValue

  const wrapper = document.createElement('label')
  wrapper.classList.add('toggle-switch')

  const checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.checked = checked
  checkbox.setAttribute('data-setting-key', settingKey)

  const slider = document.createElement('span')
  slider.classList.add('toggle-slider')

  const labelText = document.createElement('span')
  labelText.classList.add('toggle-label')
  labelText.textContent = label

  checkbox.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement
    setSettingValue(settingKey, target.checked)
  })

  wrapper.appendChild(checkbox)
  wrapper.appendChild(slider)
  wrapper.appendChild(labelText)

  if (container) {
    container.appendChild(wrapper)
  }

  return wrapper
}

export async function registerSettingCheckboxes(configs: CheckboxConfig[], container: HTMLElement): Promise<HTMLElement[]> {
  const checkboxes = await Promise.all(configs.map(config => createSettingCheckbox({ ...config, container })))

  return checkboxes
}

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

export async function setSettingValue(key: string, value: boolean): Promise<void> {
  const stored = await storage.getItem(StorageKeys.userSettings)

  const settings: Settings = (typeof stored === 'object' && stored !== null)
    ? stored as Settings
    : {}

  settings[key] = value

  await storage.setItem(StorageKeys.userSettings, settings)
}
