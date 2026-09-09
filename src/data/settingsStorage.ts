/**
 * Reads and writes the one settings row Dexie holds. Thin on purpose — no
 * validation, no defaulting logic beyond the single merge below — so this
 * file needs no test of its own, the same way `db.ts` has none. The
 * interesting logic (tariff validation, discharge-coefficient scoping) lives
 * in pure, tested modules under `src/settings/`.
 */

import { db, SETTINGS_ROW_ID, type StoredSettingsRow } from './db.ts'
import { DEFAULT_CALC_SETTINGS } from '../calc/constants.ts'
import type { CalcSettings } from '../calc/types.ts'
import type { TariffDraftFields } from '../settings/tariffDraft.ts'

export interface LoadedSettings {
  settings: CalcSettings
  tariffDraft: TariffDraftFields | null
}

/**
 * `DEFAULT_CALC_SETTINGS` applies until this resolves — callers must not
 * await this before rendering. Merges onto the default so a settings row
 * saved by an earlier version of this app, missing a field this version
 * added, still reads back as a complete `CalcSettings`.
 */
export async function loadStoredSettings(): Promise<LoadedSettings> {
  const row = await db.settings.get(SETTINGS_ROW_ID)

  if (!row) {
    return { settings: DEFAULT_CALC_SETTINGS, tariffDraft: null }
  }

  return {
    settings: { ...DEFAULT_CALC_SETTINGS, ...row.settings },
    tariffDraft: row.tariffDraft ?? null,
  }
}

export async function saveStoredSettings(next: LoadedSettings): Promise<void> {
  const row: StoredSettingsRow = {
    id: SETTINGS_ROW_ID,
    settings: next.settings,
    tariffDraft: next.tariffDraft ?? undefined,
  }
  await db.settings.put(row)
}
