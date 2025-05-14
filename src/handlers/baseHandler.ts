import type { LocalStorageKey } from '../shared/storageKeys'
import type { BandcampDomHandler } from './bandcampDomHandler'
import { storage } from '#imports'
import { dispatchCustomEvent, onCustomEvent } from '../shared/utils'
import { decodeFromLocalStorage, encodeForLocalStorage } from '../storage/storageCodec'

/**
 * Base class for all handlers that interact with Bandcamp pages.
 * Provides common functionality for storage operations, initialization flow,
 * and data validation.
 */
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

  /**
   * Define the conditions under which this handler should load.
   * Override in subclasses to specify page conditions.
   */
  abstract hasLoadingConditions(): boolean

  /**
   * Set up event listeners specific to this handler.
   * Override in subclasses to add custom event listeners.
   */
  protected setupEventListeners(): void {
    // Override in subclasses
  }

  /**
   * Initialize storage data. Should be called after construction.
   * Override in subclasses to load handler-specific data.
   */
  public abstract initStorageData(): Promise<void>

  /**
   * Load data from storage with automatic decoding.
   */
  protected async loadFromStorage<T>(storageKey: LocalStorageKey, defaultValue: T): Promise<T> {
    const raw = await storage.getItem(storageKey)
    const decoded = typeof raw === 'string' ? decodeFromLocalStorage<T>(raw) : null

    return decoded ?? defaultValue
  }

  /**
   * Save data to storage with automatic encoding.
   */
  protected async saveToStorage<T>(storageKey: LocalStorageKey, data: T): Promise<void> {
    await storage.setItem(storageKey, encodeForLocalStorage(data))
  }

  /**
   * Validate that data is an object (not an array).
   */
  protected validateObjectData<T extends object>(data: unknown, errorMessage: string): data is T {
    if (typeof data !== 'object' || Array.isArray(data) || data === null) {
      console.error(errorMessage, data)
      return false
    }
    return true
  }

  /**
   * Validate that data is an array.
   */
  protected validateArrayData<T>(data: unknown, errorMessage: string): data is T[] {
    if (!Array.isArray(data)) {
      console.error(errorMessage, data)
      return false
    }
    return true
  }

  /**
   * Dispatch a custom event with the given name and detail.
   */
  protected dispatchEvent<T>(eventName: string, detail?: T): void {
    dispatchCustomEvent(eventName, detail)
  }

  /**
   * Add a typed event listener for custom events.
   */
  protected onEvent<T>(eventName: string, handler: (detail: T) => void): void {
    onCustomEvent(eventName, handler)
  }
}
