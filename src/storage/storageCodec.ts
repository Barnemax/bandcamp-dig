import { deflate, inflate } from 'pako'

export function encodeForLocalStorage<T>(data: T): string {
  return compress(data)
}

function compress(obj: unknown): string {
  const json = JSON.stringify(obj)
  const compressed = deflate(json)

  // Chunked: spreading a large Uint8Array into fromCharCode overflows the call stack
  let base64 = ''
  const chunk = 8192
  for (let i = 0; i < compressed.length; i += chunk) {
    base64 += String.fromCharCode(...compressed.subarray(i, i + chunk))
  }
  return btoa(base64)
}

function decompress(str: string): unknown {
  if (typeof str !== 'string') {
    return null
  }

  const binaryString = atob(str)
  const binary = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    binary[i] = binaryString.charCodeAt(i)
  }

  const json = inflate(binary, { toText: true })

  return JSON.parse(json)
}

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
