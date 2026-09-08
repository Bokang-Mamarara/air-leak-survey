import { useEffect, useState } from 'react'
import { db, type LeakRecord } from '../data/db.ts'
import { buildLeakRecord } from '../data/buildLeakRecord.ts'
import { getDeviceId } from '../data/deviceId.ts'
import { getLeakType } from '../data/leakTypes.ts'
import { LEVEL_ID } from '../map/planImage.ts'
import { MapScreen } from '../map/MapScreen.tsx'
import type { ImageXY } from '../map/coordinates.ts'
import { LeakTypePicker } from './LeakTypePicker.tsx'
import { SyncQueueBadge } from '../sync/SyncQueueBadge.tsx'
import { UpdatePrompt } from '../sync/UpdatePrompt.tsx'

const buttonStyle = {
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

const saveButtonStyle = {
  ...buttonStyle,
  border: '2px solid #4caf6e',
  background: '#4caf6e',
  color: '#0b0f14',
  fontWeight: 700,
  flex: 1,
} as const

const disabledSaveButtonStyle = {
  ...buttonStyle,
  border: '2px solid #3a4757',
  background: '#2a333f',
  color: '#6b7684',
  fontWeight: 700,
  flex: 1,
  cursor: 'not-allowed',
} as const

const fieldLabelStyle = {
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

export function CaptureScreen() {
  const [records, setRecords] = useState<LeakRecord[]>([])
  const [pendingXY, setPendingXY] = useState<ImageXY | null>(null)
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null)
  const [diameterInput, setDiameterInput] = useState('')
  const [noteInput, setNoteInput] = useState('')
  const [moreDetailOpen, setMoreDetailOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    db.leakRecords
      .where('levelId')
      .equals(LEVEL_ID)
      .toArray()
      .then(setRecords)
      .catch((err: unknown) => {
        console.error(err)
        setError('Could not load existing leaks from this device.')
      })
  }, [])

  function resetPending() {
    setPendingXY(null)
    setSelectedTypeId(null)
    setDiameterInput('')
    setNoteInput('')
    setMoreDetailOpen(false)
    setError(null)
  }

  function handleValidTap(xy: ImageXY) {
    resetPending()
    setPendingXY(xy)
  }

  const selectedType = selectedTypeId ? getLeakType(selectedTypeId) : null
  const diameterOverrideMm = diameterInput.trim() === '' ? null : Number(diameterInput)
  const boreRequired = selectedType != null && selectedType.equivalentDiameterMm == null
  const boreMissing = boreRequired && diameterOverrideMm == null

  const canSave = pendingXY != null && selectedType != null && !boreMissing && !saving

  function handleSave() {
    if (!canSave || !pendingXY || !selectedType) {
      return
    }

    setSaving(true)
    setError(null)

    let record: LeakRecord
    try {
      record = buildLeakRecord({
        id: crypto.randomUUID(),
        levelId: LEVEL_ID,
        x: pendingXY.x,
        y: pendingXY.y,
        leakType: selectedType,
        diameterOverrideMm,
        note: noteInput.trim() === '' ? undefined : noteInput.trim(),
        loggedAt: new Date().toISOString(),
        loggedBy: getDeviceId(),
      })
    } catch (err) {
      console.error(err)
      setSaving(false)
      setError('Could not build this record.')
      return
    }

    db.leakRecords
      .add(record)
      .then(() => {
        setRecords((previous) => [...previous, record])
        setSaving(false)
        resetPending()
      })
      .catch((err: unknown) => {
        console.error(err)
        setSaving(false)
        setError('Could not save — try again.')
      })
  }

  return (
    <div style={{ position: 'relative', height: '100dvh', width: '100%' }}>
      <MapScreen
        markers={records.map((record) => ({
          id: record.id,
          x: record.x,
          y: record.y,
          isDeliberateOpenLine: record.isDeliberateOpenLine,
        }))}
        pendingXY={pendingXY}
        onValidTap={handleValidTap}
      />

      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 8,
        }}
      >
        <SyncQueueBadge />
        <UpdatePrompt />
      </div>

      {pendingXY && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1000,
            maxHeight: '70vh',
            overflowY: 'auto',
            padding: 16,
            background: '#0b0f14',
            borderTop: '1px solid #3a4757',
            boxShadow: '0 -4px 16px rgba(0,0,0,0.5)',
          }}
        >
          <LeakTypePicker selectedId={selectedTypeId} onSelect={setSelectedTypeId} />

          {boreRequired && (
            <div style={{ marginTop: 14 }}>
              <label style={fieldLabelStyle} htmlFor="bore-input">
                Bore / nominal pipe size (mm)
              </label>
              <input
                id="bore-input"
                type="number"
                inputMode="decimal"
                min={0}
                style={inputStyle}
                value={diameterInput}
                onChange={(event) => setDiameterInput(event.target.value)}
              />
              {boreMissing && (
                <p style={{ fontSize: 13, color: '#e2574c', margin: '6px 0 0' }}>
                  Enter the opened line's bore to save.
                </p>
              )}
            </div>
          )}

          <button
            type="button"
            style={{ ...buttonStyle, marginTop: 14 }}
            onClick={() => setMoreDetailOpen((open) => !open)}
          >
            More detail {moreDetailOpen ? '▾' : '▸'}
          </button>

          {moreDetailOpen && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {!boreRequired && (
                <div>
                  <label style={fieldLabelStyle} htmlFor="diameter-override-input">
                    Measured diameter override (mm)
                  </label>
                  <input
                    id="diameter-override-input"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    style={inputStyle}
                    value={diameterInput}
                    onChange={(event) => setDiameterInput(event.target.value)}
                  />
                </div>
              )}
              <div>
                <label style={fieldLabelStyle} htmlFor="note-input">
                  Note
                </label>
                <textarea
                  id="note-input"
                  style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
                  value={noteInput}
                  onChange={(event) => setNoteInput(event.target.value)}
                />
              </div>
            </div>
          )}

          {error && <p style={{ fontSize: 13, color: '#e2574c' }}>{error}</p>}

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button type="button" style={buttonStyle} onClick={resetPending}>
              Cancel
            </button>
            <button
              type="button"
              style={canSave ? saveButtonStyle : disabledSaveButtonStyle}
              onClick={handleSave}
              disabled={!canSave}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
