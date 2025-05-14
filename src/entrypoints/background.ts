// entrypoints/background.ts

const MAX_429_RETRIES = 3

async function fetchWithRetry(url: string): Promise<Response> {
  for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt++) {
    const res = await fetch(url)
    if (res.status !== 429 || attempt === MAX_429_RETRIES) {
      return res
    }
    const retryAfter = Number.parseInt(res.headers.get('Retry-After') ?? '5') * 1000
    await new Promise(resolve => setTimeout(resolve, retryAfter))
  }
  throw new Error('Max retries exceeded')
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    switch (message.type || message.action) {
      case 'FETCH_URL':
        fetchWithRetry(message.url)
          .then(response => response.text())
          .then((html) => {
            sendResponse({ success: true, html })
          })
          .catch((error) => {
            console.error('Fetch failed:', error)
            sendResponse({ success: false, error: error.message })
          })
        return true

      case 'FETCH_JSON':
        fetch(message.url, {
          method: message.method ?? 'GET',
          body: message.body !== undefined ? JSON.stringify(message.body) : undefined,
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        })
          .then(r => r.json())
          .then(data => sendResponse({ success: true, data }))
          .catch((error) => {
            console.error('Fetch JSON failed:', error)
            sendResponse({ success: false, error: error.message })
          })
        return true

      case 'openPopup':
        browser.action.openPopup()
        return false

      default:
        console.warn('Unknown message type:', message)
    }
  })
})
