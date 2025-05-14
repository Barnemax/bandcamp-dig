import type { BandcampDomHandler } from '../handlers/bandcampDomHandler'

/**
 * Returns a typed stub for BandcampDomHandler.
 * Used in tests that mock BaseHandler entirely — the actual arg is ignored at runtime,
 * but this avoids scattering `{} as any` casts across test files.
 */
export function makeMockDomHandler(overrides?: Partial<BandcampDomHandler>): BandcampDomHandler {
  return { ...overrides } as BandcampDomHandler
}
