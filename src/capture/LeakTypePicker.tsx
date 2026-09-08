import type { CSSProperties } from 'react'
import { LEAK_TYPES, OPEN_LINE_TYPES } from '../data/leakTypes.ts'
import type { LeakTypeDefinition } from '../calc/types.ts'
import { LEAK_ACCENT_COLOR, OPEN_LINE_ACCENT_COLOR } from './colors.ts'

interface LeakTypePickerProps {
  selectedId: string | null
  onSelect: (leakTypeId: string) => void
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
  gap: 10,
}

function tileStyle(accent: string, selected: boolean): CSSProperties {
  return {
    minHeight: 48,
    minWidth: 48,
    padding: '12px 10px',
    borderRadius: 8,
    border: `2px solid ${selected ? accent : '#3a4757'}`,
    background: selected ? accent : '#141b23',
    color: selected ? '#0b0f14' : '#f2f5f8',
    fontSize: 15,
    fontWeight: selected ? 700 : 400,
    textAlign: 'center',
    cursor: 'pointer',
  }
}

function TypeGrid({
  types,
  accent,
  selectedId,
  onSelect,
}: {
  types: readonly LeakTypeDefinition[]
  accent: string
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div style={gridStyle}>
      {types.map((type) => (
        <button
          key={type.id}
          type="button"
          style={tileStyle(accent, selectedId === type.id)}
          onClick={() => onSelect(type.id)}
        >
          {type.label}
        </button>
      ))}
    </div>
  )
}

export function LeakTypePicker({ selectedId, onSelect }: LeakTypePickerProps) {
  return (
    <div>
      <h2 style={{ fontSize: 15, margin: '0 0 8px', color: '#f2f5f8' }}>Leak type</h2>
      <TypeGrid
        types={LEAK_TYPES}
        accent={LEAK_ACCENT_COLOR}
        selectedId={selectedId}
        onSelect={onSelect}
      />

      <div
        style={{
          marginTop: 16,
          padding: 10,
          borderRadius: 8,
          border: `2px solid ${OPEN_LINE_ACCENT_COLOR}`,
          background: 'rgba(63, 167, 214, 0.08)',
        }}
      >
        <h2 style={{ fontSize: 15, margin: '0 0 4px', color: OPEN_LINE_ACCENT_COLOR }}>
          Not a leak — deliberate open line
        </h2>
        <p style={{ fontSize: 13, margin: '0 0 8px', color: '#c3ccd6' }}>
          A ventilation shortfall someone is compensating for, not damaged
          equipment. Fixed with a ventilation intervention, not a repair job.
        </p>
        <TypeGrid
          types={OPEN_LINE_TYPES}
          accent={OPEN_LINE_ACCENT_COLOR}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      </div>
    </div>
  )
}
