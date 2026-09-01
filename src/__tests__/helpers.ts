import type { BandcampDomHandler } from '../handlers/bandcampDomHandler'

/** Ignored at runtime where BaseHandler is mocked; avoids `{} as any` in every test file. */
export function makeMockDomHandler(overrides?: Partial<BandcampDomHandler>): BandcampDomHandler {
  return { ...overrides } as BandcampDomHandler
}
