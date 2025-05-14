/** Debounce delay for MutationObserver on collection grids (ms) */
export const GRID_MUTATION_DEBOUNCE_MS = 1500

/** Delay between individual track status fetches to avoid rate limiting (ms) */
export const FETCH_THROTTLE_MS = 200

/** Delay between artist page fetches during scanning (ms) */
export const ARTIST_SCAN_DELAY_MS = 100

/** Delay between batches of release page fetches during artist scanning (ms) */
export const RELEASE_FETCH_DELAY_MS = 50

/** Number of release pages to fetch concurrently during artist scanning */
export const RELEASE_FETCH_CONCURRENCY = 3

/** Number of artist pages to fetch concurrently during scanning */
export const ARTIST_FETCH_CONCURRENCY = 3

/** Delay before re-enabling the fetch button after completion (ms) */
export const BUTTON_RESET_DELAY_MS = 3000

/** TTL for the onboarding artist cache (7 days in ms) */
export const ONBOARDING_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** TTL for the onboarding in-progress lock (15 minutes in ms) — covers worst-case 50 artist fetches */
export const ONBOARDING_LOCK_TTL_MS = 15 * 60 * 1000

/** Timeout waiting for cronTasks daily/skippedDaily event before rendering stats (ms) */
export const DAILY_CHECK_TIMEOUT_MS = 5000
