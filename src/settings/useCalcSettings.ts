/**
 * Owns the app's one `CalcSettings` value and its tariff draft, backed by
 * Dexie. `DEFAULT_CALC_SETTINGS` is the state on first render; the stored
 * values, if any, arrive later through the effect below and never block
 * mount — the map still renders first on launch.
 */

import { useEffect, useState } from 'react'
import { loadStoredSettings, saveStoredSettings } from '../data/settingsStorage.ts'
import { DEFAULT_CALC_SETTINGS } from '../calc/constants.ts'
import type { CalcSettings } from '../calc/types.ts'
import type { TariffDraftFields } from './tariffDraft.ts'

export function useCalcSettings() {
  const [settings, setSettingsState] = useState<CalcSettings>(DEFAULT_CALC_SETTINGS)
  const [tariffDraft, setTariffDraftState] = useState<TariffDraftFields | null>(null)

  useEffect(() => {
    let cancelled = false

    loadStoredSettings()
      .then((loaded) => {
        if (cancelled) return
        setSettingsState(loaded.settings)
        setTariffDraftState(loaded.tariffDraft)
      })
      .catch((err: unknown) => {
        console.error(err)
      })

    return () => {
      cancelled = true
    }
  }, [])

  function persist(nextSettings: CalcSettings, nextTariffDraft: TariffDraftFields | null) {
    setSettingsState(nextSettings)
    setTariffDraftState(nextTariffDraft)
    saveStoredSettings({ settings: nextSettings, tariffDraft: nextTariffDraft }).catch(
      (err: unknown) => {
        console.error(err)
      },
    )
  }

  return {
    settings,
    tariffDraft,
    setSettings: (next: CalcSettings) => persist(next, tariffDraft),
    setTariffDraft: (next: TariffDraftFields | null) => persist(settings, next),
    // For a tariff field edit, which updates the draft and (once complete)
    // `settings.tariff` in the same keystroke: calling `setSettings` and
    // `setTariffDraft` back to back would have the second call close over
    // the first call's now-stale value of the field it does not touch,
    // silently reverting it. This updates both from the same starting point.
    setSettingsAndTariffDraft: persist,
  }
}
