/**
 * Sync configuration. Framework-free, same discipline as src/calc/constants.ts:
 * an unset value is `null`, never a fabricated default.
 */

/**
 * POST target for queued records. There is no backend for this project — see
 * the out-of-scope note in CLAUDE.md, which explicitly rules out an `api/`
 * directory. `null` means "no sync target configured", which is the expected
 * state for the life of this project, not a placeholder waiting to be filled
 * in before ship. Phase 6 settings will be the place a real deployment could
 * override this, if one ever exists.
 */
export const SYNC_ENDPOINT: string | null = null
