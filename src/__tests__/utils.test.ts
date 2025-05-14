import { describe, expect, it } from 'vitest'
import { formatLocalDate, parseArtistUrl } from '../shared/utils'

describe('utils', () => {
  describe('formatLocalDate', () => {
    it('should format a Date object', () => {
      const date = new Date('2024-06-15T12:00:00Z')
      const result = formatLocalDate(date)
      // Result depends on locale, but should contain year, month, day
      expect(result).toMatch(/2024/)
      expect(result).toMatch(/0?6|Jun/)
      expect(result).toMatch(/15/)
    })

    it('should format a date string', () => {
      const result = formatLocalDate('2024-01-01')
      expect(result).toMatch(/2024/)
      expect(result).toMatch(/0?1|Jan/)
    })

    it('should format a timestamp number', () => {
      const timestamp = new Date('2024-12-25').getTime()
      const result = formatLocalDate(timestamp)
      expect(result).toMatch(/2024/)
      expect(result).toMatch(/12|Dec/)
      expect(result).toMatch(/25/)
    })

    it('should accept custom formatting options', () => {
      const date = new Date('2024-06-15')
      const result = formatLocalDate(date, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
      // Should contain full month name (locale dependent)
      expect(result).toMatch(/2024/)
      expect(result).toMatch(/15/)
    })

    it('should use default options when none provided', () => {
      const date = new Date('2024-06-15')
      const result = formatLocalDate(date)
      // Default options: year: 'numeric', month: '2-digit', day: '2-digit'
      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
    })

    it('should handle ISO date strings', () => {
      const result = formatLocalDate('2024-06-15T10:30:00.000Z')
      expect(result).toMatch(/2024/)
    })

    it('should handle different date formats consistently', () => {
      const dateObj = new Date('2024-03-20')
      const dateStr = '2024-03-20'
      const dateTimestamp = new Date('2024-03-20').getTime()

      const resultObj = formatLocalDate(dateObj)
      const resultStr = formatLocalDate(dateStr)
      const resultTimestamp = formatLocalDate(dateTimestamp)

      // All three should produce the same output
      expect(resultObj).toBe(resultStr)
      expect(resultStr).toBe(resultTimestamp)
    })
  })

  describe('parseArtistUrl', () => {
    it('should remove /music from the end of the URL', () => {
      const url = 'https://astralindustries.bandcamp.com/music'
      const result = parseArtistUrl(url)
      expect(result).toBe('https://astralindustries.bandcamp.com')
    })

    it('should remove trailing slash from the URL', () => {
      const url = 'https://astralindustries.bandcamp.com/'
      const result = parseArtistUrl(url)
      expect(result).toBe('https://astralindustries.bandcamp.com')
    })
  })
})
