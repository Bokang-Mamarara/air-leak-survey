import { useEffect, useState, type ReactNode } from 'react'
import { liveQuery } from 'dexie'
import { db } from '../data/db.ts'
import type { CalcSettings } from '../calc/types.ts'
import {
  applyOpenLineCoefficient,
  applySharpEdgedCoefficient,
  currentOpenLineCoefficient,
  currentSharpEdgedCoefficient,
  openLineGroupLabels,
  sharpEdgedExcludedLeakLabels,
  sharpEdgedGroupLabels,
} from './dischargeCoefficientGroups.ts'
import {
  blankTariffDraft,
  filledNumericFieldCount,
  hasSource,
  tariffToDraft,
  totalDraftHours,
  tryBuildTariff,
  TARIFF_NUMERIC_FIELD_COUNT,
  type TariffDraftFields,
} from './tariffDraft.ts'
import { HELP } from './helpText.ts'

interface SettingsScreenProps {
  settings: CalcSettings
  tariffDraft: TariffDraftFields | null
  onChangeSettings: (next: CalcSettings) => void
  onChangeSettingsAndTariffDraft: (
    nextSettings: CalcSettings,
    nextTariffDraft: TariffDraftFields | null,
  ) => void
  onBack: () => void
}

const navButtonStyle = {
  minHeight: 48,
  minWidth: 48,
  padding: '10px 18px',
  borderRadius: 8,
  fontSize: 15,
  border: '2px solid #3a4757',
  background: '#141b23',
  color: '#f2f5f8',
  cursor: 'pointer',
} as const

const dangerButtonStyle = {
  ...navButtonStyle,
  border: '2px solid #e2574c',
  color: '#e2574c',
} as const

const sectionStyle = {
  padding: '16px 20px',
  borderBottom: '1px solid #232c37',
} as const

const captionStyle = {
  fontSize: 13,
  color: '#c3ccd6',
  lineHeight: 1.5,
  margin: '4px 0 0',
} as const

const labelStyle = {
  display: 'block',
  fontSize: 13,
  color: '#c3ccd6',
  marginBottom: 4,
} as const

const inputStyle = {
  width: '100%',
  minHeight: 44,
  padding: '8px 10px',
  borderRadius: 6,
  border: '1px solid #3a4757',
  background: '#0b0f14',
  color: '#f2f5f8',
  fontSize: 15,
  boxSizing: 'border-box',
} as const

const fieldWrapStyle = { marginBottom: 16 } as const

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '0 16px',
} as const

const seasonBlockStyle = {
  padding: '12px',
  borderRadius: 8,
  border: '1px solid #3a4757',
  marginBottom: 12,
} as const

function Field({
  id,
  label,
  help,
  children,
}: {
  id: string
  label: string
  help: string
  children: ReactNode
}) {
  return (
    <div style={fieldWrapStyle}>
      <label htmlFor={id} style={labelStyle}>
        {label}
      </label>
      {children}
      <p style={captionStyle}>{help}</p>
    </div>
  )
}

function NumberField({
  id,
  label,
  help,
  value,
  onCommit,
  min,
  max,
  step = 'any',
  allowNull = false,
}: {
  id: string
  label: string
  help: string
  value: number | null
  onCommit: (value: number | null) => void
  min?: number
  max?: number
  step?: number | 'any'
  allowNull?: boolean
}) {
  const [text, setText] = useState(value === null ? '' : String(value))

  return (
    <Field id={id} label={label} help={help}>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        style={inputStyle}
        min={min}
        max={max}
        step={step}
        value={text}
        onChange={(event) => {
          const raw = event.target.value
          setText(raw)
          if (raw.trim() === '') {
            if (allowNull) onCommit(null)
            return
          }
          const parsed = Number(raw)
          if (Number.isFinite(parsed)) onCommit(parsed)
        }}
      />
    </Field>
  )
}

function TextField({
  id,
  label,
  help,
  value,
  onCommit,
}: {
  id: string
  label: string
  help: string
  value: string | null
  onCommit: (value: string | null) => void
}) {
  const [text, setText] = useState(value ?? '')

  return (
    <Field id={id} label={label} help={help}>
      <input
        id={id}
        type="text"
        style={inputStyle}
        value={text}
        onChange={(event) => {
          const raw = event.target.value
          setText(raw)
          onCommit(raw.trim() === '' ? null : raw)
        }}
      />
    </Field>
  )
}

export function SettingsScreen({
  settings,
  tariffDraft,
  onChangeSettings,
  onChangeSettingsAndTariffDraft,
  onBack,
}: SettingsScreenProps) {
  const [recordCount, setRecordCount] = useState<number | null>(null)
  const [clearing, setClearing] = useState(false)
  const [clearError, setClearError] = useState<string | null>(null)

  useEffect(() => {
    const subscription = liveQuery(() => db.leakRecords.count()).subscribe({
      next: setRecordCount,
      error: (err: unknown) => console.error(err),
    })
    return () => subscription.unsubscribe()
  }, [])

  function handleClearRecords() {
    if (!recordCount) return

    const confirmed = window.confirm(
      `Delete all ${recordCount} logged leak${recordCount === 1 ? '' : 's'} and open line${
        recordCount === 1 ? '' : 's'
      } from this device? This cannot be undone. Settings are not affected.`,
    )
    if (!confirmed) return

    setClearing(true)
    setClearError(null)
    db.leakRecords
      .clear()
      .catch((err: unknown) => {
        console.error(err)
        setClearError('Could not clear records — try again.')
      })
      .finally(() => setClearing(false))
  }

  const draft: TariffDraftFields = settings.tariff
    ? tariffToDraft(settings.tariff)
    : (tariffDraft ?? blankTariffDraft())

  function updateTariffField(mutate: (next: TariffDraftFields) => void) {
    const next = structuredClone(draft)
    mutate(next)
    const built = tryBuildTariff(next)
    onChangeSettingsAndTariffDraft({ ...settings, tariff: built }, next)
  }

  const filledCount = filledNumericFieldCount(draft)
  const sourceOk = hasSource(draft)
  const tariffApplied = settings.tariff !== null
  const hoursSum = totalDraftHours(draft)

  const sharpEdgedLabels = sharpEdgedGroupLabels(settings.leakTypes)
  const sharpEdgedExcluded = sharpEdgedExcludedLeakLabels(settings.leakTypes)
  const openLineLabels = openLineGroupLabels(settings.leakTypes)

  return (
    <div
      style={{
        height: '100dvh',
        width: '100%',
        overflowY: 'auto',
        background: '#0b0f14',
        color: '#f2f5f8',
      }}
    >
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '10px 16px',
          background: '#0b0f14',
          borderBottom: '1px solid #232c37',
        }}
      >
        <button type="button" style={navButtonStyle} onClick={onBack}>
          {'◀'} Register
        </button>
        <h1 style={{ fontSize: 16, margin: 0 }}>Settings</h1>
        <div style={{ width: 48 }} />
      </div>

      <div style={sectionStyle}>
        <h2 style={{ fontSize: 14, margin: '0 0 8px', color: '#e2574c' }}>Danger zone</h2>
        <button
          type="button"
          style={dangerButtonStyle}
          onClick={handleClearRecords}
          disabled={clearing || !recordCount}
        >
          {clearing ? 'Clearing…' : `Clear all records${recordCount ? ` (${recordCount})` : ''}`}
        </button>
        <p style={captionStyle}>{HELP.clearRecords}</p>
        {clearError && <p style={{ ...captionStyle, color: '#e2574c' }}>{clearError}</p>}
      </div>

      <div style={sectionStyle}>
        <h2 style={{ fontSize: 14, margin: '0 0 4px' }}>Tariff</h2>
        <p style={captionStyle}>{HELP.tariffIntro}</p>
        <p style={{ ...captionStyle, color: tariffApplied ? '#4caf6e' : '#e8a33d', fontWeight: 600 }}>
          {tariffApplied
            ? 'Tariff applied — costs are being calculated.'
            : `${filledCount} of ${TARIFF_NUMERIC_FIELD_COUNT} rates entered${
                sourceOk ? '' : ' (source also required)'
              }, tariff not applied until complete.`}
        </p>

        {(['highDemandSeason', 'lowDemandSeason'] as const).map((season) => (
          <div key={season} style={seasonBlockStyle}>
            <strong style={{ fontSize: 13 }}>
              {season === 'highDemandSeason' ? 'High demand season' : 'Low demand season'}
            </strong>
            <div style={gridStyle}>
              {(['peak', 'standard', 'offPeak'] as const).map((period) => (
                <NumberField
                  key={`rate-${season}-${period}`}
                  id={`rate-${season}-${period}`}
                  label={`${period === 'offPeak' ? 'Off-peak' : period[0].toUpperCase() + period.slice(1)} rate (R/kWh)`}
                  help=""
                  min={0}
                  allowNull
                  value={
                    draft.ratesZarPerKwh[season][period].trim() === ''
                      ? null
                      : Number(draft.ratesZarPerKwh[season][period])
                  }
                  onCommit={(value) =>
                    updateTariffField((next) => {
                      next.ratesZarPerKwh[season][period] = value === null ? '' : String(value)
                    })
                  }
                />
              ))}
              {(['peak', 'standard', 'offPeak'] as const).map((period) => (
                <NumberField
                  key={`hours-${season}-${period}`}
                  id={`hours-${season}-${period}`}
                  label={`${period === 'offPeak' ? 'Off-peak' : period[0].toUpperCase() + period.slice(1)} hours/year`}
                  help=""
                  min={0}
                  allowNull
                  value={
                    draft.hoursPerYear[season][period].trim() === ''
                      ? null
                      : Number(draft.hoursPerYear[season][period])
                  }
                  onCommit={(value) =>
                    updateTariffField((next) => {
                      next.hoursPerYear[season][period] = value === null ? '' : String(value)
                    })
                  }
                />
              ))}
            </div>
          </div>
        ))}

        <TextField
          id="tariff-source"
          label="Tariff source"
          help={HELP.tariffSource}
          value={draft.source.trim() === '' ? null : draft.source}
          onCommit={(value) =>
            updateTariffField((next) => {
              next.source = value ?? ''
            })
          }
        />

        {hoursSum !== null && hoursSum !== settings.operatingHoursPerYear && (
          <p style={{ ...captionStyle, color: '#e8a33d' }}>
            Note: entered hours sum to {hoursSum}, but operating hours below is set to{' '}
            {settings.operatingHoursPerYear}.
          </p>
        )}
      </div>

      <div style={sectionStyle}>
        <h2 style={{ fontSize: 14, margin: '0 0 8px' }}>Compressor</h2>
        <NumberField
          id="compressor-specific-power"
          label="Specific power (kW per m³/s free air delivered)"
          help={HELP.compressorSpecificPower}
          min={0}
          allowNull
          value={settings.compressor.specificPowerKwPerM3PerSec}
          onCommit={(value) =>
            onChangeSettings({
              ...settings,
              compressor: { ...settings.compressor, specificPowerKwPerM3PerSec: value },
            })
          }
        />
        <TextField
          id="compressor-source"
          label="Specific power source"
          help={HELP.compressorSource}
          value={settings.compressor.source}
          onCommit={(value) =>
            onChangeSettings({ ...settings, compressor: { ...settings.compressor, source: value } })
          }
        />
        <NumberField
          id="isentropic-efficiency"
          label="Isentropic efficiency (0–1)"
          help={HELP.isentropicEfficiency}
          min={0}
          max={1}
          value={settings.compressor.isentropicEfficiency}
          onCommit={(value) =>
            onChangeSettings({
              ...settings,
              compressor: { ...settings.compressor, isentropicEfficiency: value! },
            })
          }
        />
        <NumberField
          id="polytropic-exponent"
          label="Polytropic exponent n"
          help={HELP.polytropicExponent}
          min={1.001}
          value={settings.compressor.polytropicExponent}
          onCommit={(value) =>
            onChangeSettings({
              ...settings,
              compressor: { ...settings.compressor, polytropicExponent: value! },
            })
          }
        />
        <NumberField
          id="stage-count"
          label="Stage count"
          help={HELP.stageCount}
          min={1}
          step={1}
          value={settings.compressor.stageCount}
          onCommit={(value) =>
            onChangeSettings({
              ...settings,
              compressor: { ...settings.compressor, stageCount: Math.round(value!) },
            })
          }
        />
        <NumberField
          id="compressor-discharge-pressure"
          label="Compressor discharge pressure (kPa gauge)"
          help={HELP.compressorDischargePressure}
          min={0}
          value={settings.compressor.dischargePressureKpaG}
          onCommit={(value) =>
            onChangeSettings({
              ...settings,
              compressor: { ...settings.compressor, dischargePressureKpaG: value! },
            })
          }
        />
        <NumberField
          id="compressor-inlet-temperature"
          label="Compressor inlet temperature (°C)"
          help={HELP.compressorInletTemperature}
          value={settings.compressor.inletTemperatureC}
          onCommit={(value) =>
            onChangeSettings({
              ...settings,
              compressor: { ...settings.compressor, inletTemperatureC: value! },
            })
          }
        />
      </div>

      <div style={sectionStyle}>
        <h2 style={{ fontSize: 14, margin: '0 0 8px' }}>Discharge coefficients</h2>
        <NumberField
          id="sharp-edged-coefficient"
          label="Sharp-edged"
          help={`${HELP.sharpEdgedCoefficient} Applies to: ${sharpEdgedLabels.join(', ')}.${
            sharpEdgedExcluded.length
              ? ` ${sharpEdgedExcluded.join(', ')} keeps its own value — it discharges like a machined bore, not a torn or sharp edge.`
              : ''
          }`}
          min={0}
          max={1}
          value={currentSharpEdgedCoefficient(settings.leakTypes)}
          onCommit={(value) =>
            onChangeSettings({
              ...settings,
              leakTypes: applySharpEdgedCoefficient(settings.leakTypes, value!),
            })
          }
        />
        <NumberField
          id="open-line-coefficient"
          label="Open line"
          help={`${HELP.openLineCoefficient} Applies to: ${openLineLabels.join(', ')}.`}
          min={0}
          max={1}
          value={currentOpenLineCoefficient(settings.leakTypes)}
          onCommit={(value) =>
            onChangeSettings({
              ...settings,
              leakTypes: applyOpenLineCoefficient(settings.leakTypes, value!),
            })
          }
        />
      </div>

      <div style={sectionStyle}>
        <h2 style={{ fontSize: 14, margin: '0 0 8px' }}>Line and environment</h2>
        <NumberField
          id="line-pressure"
          label="Default line pressure (kPa gauge)"
          help={HELP.linePressure}
          min={0}
          value={settings.linePressureKpaG}
          onCommit={(value) => onChangeSettings({ ...settings, linePressureKpaG: value! })}
        />
        <NumberField
          id="air-temperature"
          label="Air temperature (°C)"
          help={HELP.airTemperature}
          value={settings.airTemperatureC}
          onCommit={(value) => onChangeSettings({ ...settings, airTemperatureC: value! })}
        />
        <NumberField
          id="operating-hours"
          label="Operating hours per year"
          help={HELP.operatingHours}
          min={0}
          max={8760}
          value={settings.operatingHoursPerYear}
          onCommit={(value) => onChangeSettings({ ...settings, operatingHoursPerYear: value! })}
        />
        <NumberField
          id="diameter-uncertainty"
          label="Diameter uncertainty fraction"
          help={HELP.diameterUncertainty}
          min={0}
          max={1}
          value={settings.diameterUncertaintyFraction}
          onCommit={(value) =>
            onChangeSettings({ ...settings, diameterUncertaintyFraction: value! })
          }
        />
      </div>

      <div style={sectionStyle}>
        <details>
          <summary
            style={{
              cursor: 'pointer',
              minHeight: 48,
              display: 'flex',
              alignItems: 'center',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Advanced
          </summary>
          <div style={{ marginTop: 12 }}>
            <NumberField
              id="atmospheric-pressure"
              label="Atmospheric pressure (Pa)"
              help={HELP.atmosphericPressure}
              min={0}
              value={settings.atmosphericPressurePa}
              onCommit={(value) => onChangeSettings({ ...settings, atmosphericPressurePa: value! })}
            />
            <NumberField
              id="open-line-coefficient-uncertainty"
              label="Open-line coefficient uncertainty fraction"
              help={HELP.openLineCoefficientUncertainty}
              min={0}
              max={1}
              value={settings.openLineDischargeCoefficientUncertaintyFraction}
              onCommit={(value) =>
                onChangeSettings({
                  ...settings,
                  openLineDischargeCoefficientUncertaintyFraction: value!,
                })
              }
            />
          </div>
        </details>
      </div>
    </div>
  )
}
