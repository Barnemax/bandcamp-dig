import pako from 'pako'

// Store an object in localStorage (encoded via pako)
export function encodeForLocalStorage<T>(data: T): string {
  return compress(data)
}

// Compress an object into a binary-safe string
function compress(obj: unknown): string {
  const json = JSON.stringify(obj)
  const compressed = pako.deflate(json)

  // Uint8Array → Base64 (chunked to avoid call-stack limit)
  let base64 = ''
  const chunk = 8192
  for (let i = 0; i < compressed.length; i += chunk) {
    base64 += String.fromCharCode(...compressed.subarray(i, i + chunk))
  }
  return btoa(base64)
}

// Decompress a binary-safe string back into an object
function decompress(str: string): unknown {
  if (typeof str !== 'string') {
    return null
  }

  // Base64 → Uint8Array
  const binaryString = atob(str)
  const binary = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    binary[i] = binaryString.charCodeAt(i)
  }

  const json = pako.inflate(binary, { to: 'string' })

  return JSON.parse(json)
}

// Load and decode an object from localStorage
export function decodeFromLocalStorage<T>(data: string): T | null {
  if (!data) {
    return null
  }

  try {
    return decompress(data) as T
  }
  catch (e) {
    console.error('Failed to decode data from localStorage:', e)
    return null
  }
}

export function toKey(id: number): string {
  return `i${id}`
}
