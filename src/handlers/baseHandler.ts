import type { LocalStorageKey, StorageRevisions } from '../shared/storageKeys'
import type { BandcampDomHandler } from './bandcampDomHandler'
import { storage } from '#imports'
import { StorageKeys } from '../shared/storageKeys'
import { dispatchCustomEvent, onCustomEvent } from '../shared/utils'
import { decodeFromLocalStorage, encodeForLocalStorage } from '../storage/storageCodec'

export abstract class BaseHandler {
  public bandcampDomHandler: BandcampDomHandler
  protected loadingConditionsMet: boolean = false

  constructor(bandcampDomHandler: BandcampDomHandler) {
    this.bandcampDomHandler = bandcampDomHandler

    if (this.hasLoadingConditions() === false) {
      return
    }

    this.loadingConditionsMet = true
    this.setupEventListeners()
  }

  abstract hasLoadingConditions(): boolean

  protected setupEventListeners(): void {}

  /** Must be called after construction; the constructor cannot await. */
  public abstract initStorageData(): Promise<void>

  protected async loadFromStorage<T>(storageKey: LocalStorageKey, defaultValue: T): Promise<T> {
    const raw = await storage.getItem(storageKey)
    const decoded = typeof raw === 'string' ? decodeFromLocalStorage<T>(raw) : null

    return decoded ?? defaultValue
  }

  protected async saveToStorage<T>(storageKey: LocalStorageKey, data: T): Promise<void> {
    try {
      await storage.setItem(storageKey, encodeForLocalStorage(data))
    }
    catch (error) {
      console.error(`[BCD] Failed to save storage key "${storageKey}":`, error)
    }
  }

  protected validateObjectData<T extends object>(data: unknown, errorMessage: string): data is T {
    if (typeof data !== 'object' || Array.isArray(data) || data === null) {
      console.error(errorMessage, data)
      return false
    }
    return true
  }

  protected validateArrayData<T>(data: unknown, errorMessage: string): data is T[] {
    if (!Array.isArray(data)) {
      console.error(errorMessage, data)
      return false
    }
    return true
  }

  protected async loadRevisions(): Promise<StorageRevisions> {
    return this.loadFromStorage<StorageRevisions>(StorageKeys.storageRevisions, {})
  }

  /** Stale means another tab wrote since we loaded; the caller must re-read before writing. */
  protected async checkRevisionAndBump(
    field: keyof StorageRevisions,
    loadedRevision: number,
  ): Promise<{ isStale: boolean, newRevision: number }> {
    const revisions = await this.loadRevisions()
    const isStale = (revisions[field] ?? 0) !== loadedRevision
    const newRevision = Date.now()
    revisions[field] = newRevision
    await this.saveToStorage(StorageKeys.storageRevisions, revisions)
    return { isStale, newRevision }
  }

  protected dispatchEvent<T>(eventName: string, detail?: T): void {
    dispatchCustomEvent(eventName, detail)
  }

  protected onEvent<T>(eventName: string, handler: (detail: T) => void): void {
    onCustomEvent(eventName, handler)
  }
}
