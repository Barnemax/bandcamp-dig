export function dispatchCustomEvent<T>(eventName: string, detail?: T): void {
  window.dispatchEvent(new CustomEvent(eventName, { detail }))
}

// Tracks registered (eventName → handler) pairs to prevent duplicate listeners.
// Keys are event names; values are the raw handler references passed by callers.
const _registeredHandlers = new Map<string, Set<(detail: unknown) => void>>()

export function onCustomEvent<T>(eventName: string, handler: (detail: T) => void): void {
  const key = handler as (detail: unknown) => void
  const existing = _registeredHandlers.get(eventName)

  if (existing) {
    if (existing.has(key)) {
      return
    }
    existing.add(key)
  }
  else {
    _registeredHandlers.set(eventName, new Set([key]))
  }

  window.addEventListener(eventName, (e: Event) => {
    handler((e as CustomEvent<T>).detail)
  })
}

/**
 * Formats a date according to the user's browser locale
 * @param date The date to format (Date object, ISO string, or timestamp)
 * @param options Intl.DateTimeFormatOptions to customize the output format
 * @returns Formatted date string
 */
export function formatLocalDate(
  date: Date | string | number,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  },
): string {
  return new Date(date).toLocaleDateString(undefined, options)
}

export async function fetchDocument(url: string): Promise<Document | false> {
  const response = await browser.runtime.sendMessage({
    type: 'FETCH_URL',
    url,
  })

  if (response.success) {
    const html = response.html
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    return doc
  }
  else {
    console.error('Fetch failed:', response.error)
  }

  return false
}

export async function fetchJson<T>(url: string, body?: unknown): Promise<T | null> {
  const response = await browser.runtime.sendMessage({
    type: 'FETCH_JSON',
    url,
    method: body !== undefined ? 'POST' : 'GET',
    body,
  })

  if (response.success) {
    return response.data as T
  }

  console.error('fetchJson failed:', response.error)
  return null
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function safeUrl(url: string): string {
  try {
    const parsed = new URL(url, window.location.href)

    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? url : ''
  }
  catch {
    return url.startsWith('/') ? url : ''
  }
}

export function parseArtistUrl(url: string): string {
  // Remove /music
  if (url.endsWith('/music')) {
    url = url.slice(0, -6)
  }

  // Remove trailing slash
  if (url.endsWith('/')) {
    url = url.slice(0, -1)
  }

  return url
}

export function isFirefox(): boolean {
  return navigator.userAgent.includes('Firefox')
}
