import { storage } from '#imports'
import { DEFAULT_SETTINGS, StorageKeys } from '../shared/storageKeys'
import { strings } from '../shared/strings'
import { isFirefox } from '../shared/utils'

export async function exportButton(container: HTMLElement): Promise<void> {
  const button = container.querySelector<HTMLButtonElement>('.export-data-btn')
  if (!button) {
    console.error('Export button not found in container')
    return
  }

  button.onclick = async (): Promise<void> => {
    const nonFeatureKeys = Object.entries(StorageKeys)
      .filter(([key]) => !key.includes('Feature'))
      .map(([, value]) => value)

    const data = await Promise.all(nonFeatureKeys.map(async (key) => {
      const value = await storage.getItem(key as `local:${string}`)

      return [key, value]
    }))

    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bcd-user-export-${new Date().toISOString().replace(/:/g, '-')}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
}

export async function processImportData(raw: string): Promise<void> {
  let data: unknown
  try {
    data = JSON.parse(raw)
  }
  catch {
    alert(strings.t('dataMigration.importError'))
    return
  }

  const knownKeys = new Set<string>(Object.values(StorageKeys))
  const knownSettingsKeys = new Set(Object.keys(DEFAULT_SETTINGS))

  if (
    !Array.isArray(data)
    || data.some(entry => !Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string')
  ) {
    alert(strings.t('dataMigration.importError'))
    return
  }

  const validEntries = (data as [string, unknown][])
    .filter(([key]) => knownKeys.has(key))
    .flatMap(([key, value]): [string, unknown][] => {
      // userSettings is stored as a plain object — strip any unrecognised keys before writing
      if (key === StorageKeys.userSettings) {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          return []
        }
        const sanitized = Object.fromEntries(
          Object.entries(value as Record<string, unknown>)
            .filter(([k]) => knownSettingsKeys.has(k)),
        )

        return [[key, sanitized]]
      }
      // All other storage values are pako-encoded strings
      return typeof value === 'string' ? [[key, value]] : []
    })

  await Promise.all(validEntries.map(([key, value]) => storage.setItem(key as `local:${string}`, value)))

  alert(strings.t('dataMigration.importComplete'))
  location.reload()
}

export async function importButton(container: HTMLElement): Promise<void> {
  const button = container.querySelector<HTMLButtonElement>('.import-data-btn')
  if (!button) {
    console.error('Import button not found in container')
    return
  }

  if (isFirefox()) {
    // Firefox closes the extension popup when a file dialog opens.
    // Use a paste textarea instead.
    button.onclick = (): void => {
      const buttonList = container.querySelector('ul')
      if (!buttonList) {
        return
      }
      buttonList.style.display = 'none'

      const instruction = document.createElement('p')
      instruction.className = 'import-instruction'
      instruction.textContent = strings.t('dataMigration.pasteInstruction')

      const textarea = document.createElement('textarea')
      textarea.className = 'import-paste-area'

      const actions = document.createElement('div')
      actions.className = 'import-paste-actions'

      const confirmBtn = document.createElement('button')
      confirmBtn.className = 'btn-like'
      confirmBtn.textContent = strings.t('dataMigration.pasteConfirm')

      const cancelBtn = document.createElement('button')
      cancelBtn.className = 'btn-like'
      cancelBtn.textContent = strings.t('common.cancel')

      actions.appendChild(confirmBtn)
      actions.appendChild(cancelBtn)
      container.appendChild(instruction)
      container.appendChild(textarea)
      container.appendChild(actions)

      const teardown = (): void => {
        instruction.remove()
        textarea.remove()
        actions.remove()
        buttonList.style.display = ''
      }

      cancelBtn.onclick = teardown

      confirmBtn.onclick = async (): Promise<void> => {
        await processImportData(textarea.value)
      }
    }
  }
  else {
    // Chrome: file picker works fine in extension popup.
    button.onclick = async (): Promise<void> => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.json'
      input.style.display = 'none'
      document.body.appendChild(input)
      input.onchange = async (event): Promise<void> => {
        document.body.removeChild(input)
        const file = (event.target as HTMLInputElement).files?.[0]
        if (!file) {
          return
        }
        await processImportData(await file.text())
      }
      input.click()
    }
  }
}
