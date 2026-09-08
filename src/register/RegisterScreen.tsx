import { useEffect, useMemo, useState } from 'react'
import { liveQuery } from 'dexie'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  DEFAULT_CALC_SETTINGS,
  REALISED_SAVING_CAVEAT,
  summariseLeaks,
  type LeakResult,
  type LeakTypeLoss,
  type LoggedLeak,
  type Range,
  type SummarisedLeak,
} from '../calc/index.ts'
import { db, type LeakRecord, type RepairStatus } from '../data/db.ts'
import { LEAK_ACCENT_COLOR, OPEN_LINE_ACCENT_COLOR } from '../capture/colors.ts'
import { bandBasis, buildCsv } from './csv.ts'

const REPAIR_STATUSES: RepairStatus[] = ['open', 'scheduled', 'repaired', 'verified']

interface RegisterScreenProps {
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

const sectionStyle = {
  padding: '16px 20px',
  borderBottom: '1px solid #232c37',
} as const

const totalBlockStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '14px 16px',
  borderRadius: 8,
  border: '1px solid #3a4757',
  background: '#141b23',
} as const

const captionStyle = {
  fontSize: 13,
  color: '#c3ccd6',
  lineHeight: 1.5,
  margin: 0,
} as const

const tableWrapStyle = {
  overflowX: 'auto',
  marginTop: 12,
} as const

const tableStyle = {
  width: '100%',
  minWidth: 720,
  borderCollapse: 'collapse',
  fontSize: 13,
} as const

const thStyle = {
  textAlign: 'left',
  padding: '8px 10px',
  borderBottom: '2px solid #3a4757',
  color: '#c3ccd6',
  whiteSpace: 'nowrap',
} as const

const tdStyle = {
  padding: '8px 10px',
  borderBottom: '1px solid #232c37',
  whiteSpace: 'nowrap',
} as const

const selectStyle = {
  minHeight: 44,
  minWidth: 48,
  padding: '4px 8px',
  borderRadius: 6,
  border: '1px solid #3a4757',
  background: '#0b0f14',
  color: '#f2f5f8',
  fontSize: 13,
} as const

function formatRange(range: Range, decimals: number): string {
  const fmt = (value: number) =>
    value.toLocaleString('en-ZA', { maximumFractionDigits: decimals, minimumFractionDigits: 0 })

  return `${fmt(range.low)}–${fmt(range.high)} (${fmt(range.expected)} expected)`
}

function formatZarRange(range: Range): string {
  const fmt = (value: number) => value.toLocaleString('en-ZA', { maximumFractionDigits: 0 })

  return `R${fmt(range.low)}–R${fmt(range.high)} (R${fmt(range.expected)} expected)`
}

function preferredPower(result: LeakResult) {
  if (result.power.empirical.preferred) return result.power.empirical
  if (result.power.theoretical.preferred) return result.power.theoretical
  return null
}

function CostCell({ result }: { result: LeakResult }) {
  if (result.annualCostZar) {
    return <>{formatZarRange(result.annualCostZar)}</>
  }
  if (result.costUnavailableReason === 'no-tariff-set') {
    return <span style={{ color: '#e8a33d' }}>tariff not set</span>
  }
  if (result.flowUnavailableReason === 'not-choked') {
    return <span style={{ color: '#e2574c' }}>not choked at this pressure</span>
  }
  return <>{'—'}</>
}

function PowerCell({ result }: { result: LeakResult }) {
  const power = preferredPower(result)
  if (!power || !power.powerKw) {
    return <>{'—'}</>
  }
  return <span title={power.basis}>{formatRange(power.powerKw, 2)} kW</span>
}

interface RegisterTableProps {
  rows: SummarisedLeak[]
  records: Map<string, LeakRecord>
  diameterLabel: string
  onRepairStatusChange: (id: string, status: RepairStatus) => void
}

function RegisterTable({ rows, records, diameterLabel, onRepairStatusChange }: RegisterTableProps) {
  if (rows.length === 0) {
    return <p style={captionStyle}>None logged yet.</p>
  }

  return (
    <div style={tableWrapStyle}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Type</th>
            <th style={thStyle}>Position</th>
            <th style={thStyle}>{diameterLabel}</th>
            <th style={thStyle}>Power</th>
            <th style={thStyle}>Energy (kWh/yr)</th>
            <th style={thStyle}>Cost (R/yr)</th>
            <th style={thStyle}>Repair status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const record = records.get(row.id)
            return (
              <tr key={row.id}>
                <td style={tdStyle}>{row.label}</td>
                <td style={tdStyle}>
                  {record ? `${Math.round(record.x)}, ${Math.round(record.y)}` : '—'}
                </td>
                <td style={tdStyle}>
                  {row.result.equivalentDiameterMm ? (
                    <span title={bandBasis(row.result, DEFAULT_CALC_SETTINGS)}>
                      {formatRange(row.result.equivalentDiameterMm, 1)} mm
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td style={tdStyle}>
                  <PowerCell result={row.result} />
                </td>
                <td style={tdStyle}>
                  {row.result.annualEnergyKwh ? formatRange(row.result.annualEnergyKwh, 0) : '—'}
                </td>
                <td style={tdStyle}>
                  <CostCell result={row.result} />
                </td>
                <td style={tdStyle}>
                  <select
                    style={selectStyle}
                    value={record?.repairStatus ?? 'open'}
                    onChange={(event) =>
                      onRepairStatusChange(row.id, event.target.value as RepairStatus)
                    }
                  >
                    {REPAIR_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function LossByTypeChart({ rows, tariffIsSet }: { rows: LeakTypeLoss[]; tariffIsSet: boolean }) {
  const data = rows
    .map((row) => ({
      label: row.label,
      category: row.category,
      value: tariffIsSet ? (row.annualCostZar as Range).expected : row.annualEnergyKwh.expected,
    }))
    .sort((a, b) => b.value - a.value)

  if (data.length === 0) {
    return <p style={captionStyle}>Nothing logged yet — the chart appears once leaks are recorded.</p>
  }

  return (
    <div style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid stroke="#232c37" vertical={false} />
          <XAxis dataKey="label" stroke="#c3ccd6" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={70} />
          <YAxis
            stroke="#c3ccd6"
            tick={{ fontSize: 11 }}
            label={{
              value: tariffIsSet ? 'Annual cost (R, expected)' : 'Annual energy (kWh/yr, expected)',
              angle: -90,
              position: 'insideLeft',
              fill: '#c3ccd6',
              fontSize: 11,
            }}
          />
          <Tooltip
            contentStyle={{ background: '#141b23', border: '1px solid #3a4757', color: '#f2f5f8' }}
            formatter={(value) =>
              typeof value === 'number'
                ? value.toLocaleString('en-ZA', { maximumFractionDigits: 0 })
                : String(value)
            }
          />
          <Bar dataKey="value">
            {data.map((entry) => (
              <Cell
                key={entry.label}
                fill={entry.category === 'leak' ? LEAK_ACCENT_COLOR : OPEN_LINE_ACCENT_COLOR}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function RegisterScreen({ onBack }: RegisterScreenProps) {
  const [records, setRecords] = useState<LeakRecord[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const subscription = liveQuery(() => db.leakRecords.toArray()).subscribe({
      next: setRecords,
      error: (err: unknown) => {
        console.error(err)
        setError('Could not load the register from this device.')
      },
    })

    return () => subscription.unsubscribe()
  }, [])

  const recordsById = useMemo(() => new Map(records.map((record) => [record.id, record])), [records])

  const summary = useMemo(() => {
    const loggedLeaks: LoggedLeak[] = records.map((record) => ({
      id: record.id,
      leakTypeId: record.leakTypeId,
      equivalentDiameterMm: record.equivalentDiameterMm,
      // Falls back to 'catalogue' for a record written before this field
      // existed — the same "unknown means the safe default, never a
      // fabricated 'measured'" reasoning as everywhere else null is handled.
      diameterProvenance: record.diameterProvenance ?? 'catalogue',
      linePressureKpaG: record.linePressureKpaG,
    }))

    return summariseLeaks(loggedLeaks, DEFAULT_CALC_SETTINGS)
  }, [records])

  const tariffIsSet = DEFAULT_CALC_SETTINGS.tariff !== null

  function handleRepairStatusChange(id: string, repairStatus: RepairStatus) {
    db.leakRecords.update(id, { repairStatus }).catch((err: unknown) => {
      console.error(err)
      setError('Could not save that repair status — try again.')
    })
  }

  function handleExport() {
    const csv = buildCsv(summary, recordsById, DEFAULT_CALC_SETTINGS)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `leak-register-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

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
          {'◀'} Map
        </button>
        <h1 style={{ fontSize: 16, margin: 0 }}>Leak register</h1>
        <button type="button" style={navButtonStyle} onClick={handleExport}>
          Export CSV
        </button>
      </div>

      {error && (
        <p style={{ ...captionStyle, color: '#e2574c', padding: '0 20px' }}>{error}</p>
      )}

      <div style={sectionStyle}>
        <div style={totalBlockStyle}>
          <strong>Total potential leak loss</strong>
          <span>
            {summary.leakTotals.annualCostZar
              ? formatZarRange(summary.leakTotals.annualCostZar)
              : 'tariff not set'}
            {' · '}
            {formatRange(summary.leakTotals.annualEnergyKwh, 0)} kWh/yr
            {' · '}
            {summary.leakTotals.count} logged
          </span>
          <p style={captionStyle}>{REALISED_SAVING_CAVEAT}</p>
        </div>
      </div>

      <div style={sectionStyle}>
        <h2 style={{ fontSize: 14, margin: '0 0 4px' }}>Loss by leak type</h2>
        <LossByTypeChart rows={summary.byLeakType} tariffIsSet={tariffIsSet} />
      </div>

      <div style={sectionStyle}>
        <h2 style={{ fontSize: 14, margin: '0 0 8px' }}>Leaks</h2>
        <RegisterTable
          rows={summary.leaks}
          records={recordsById}
          diameterLabel="Equivalent diameter"
          onRepairStatusChange={handleRepairStatusChange}
        />
      </div>

      <div style={sectionStyle}>
        <div style={totalBlockStyle}>
          <strong>Self-ventilation / open lines — not a leak</strong>
          <p style={captionStyle}>
            A deliberate open valve compensating for a ventilation shortfall. The fix is a
            ventilation intervention, not a maintenance job, so this total is costed the same way
            but kept separate and is never added to the leak total above.
          </p>
          <span>
            {summary.openLineTotals.annualCostZar
              ? formatZarRange(summary.openLineTotals.annualCostZar)
              : 'tariff not set'}
            {' · '}
            {formatRange(summary.openLineTotals.annualEnergyKwh, 0)} kWh/yr
            {' · '}
            {summary.openLineTotals.count} logged
          </span>
        </div>
        <RegisterTable
          rows={summary.openLines}
          records={recordsById}
          diameterLabel="Nominal bore"
          onRepairStatusChange={handleRepairStatusChange}
        />
      </div>
    </div>
  )
}
