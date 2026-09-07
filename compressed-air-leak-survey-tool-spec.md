# Compressed Air Leak Survey Tool — Technical Specification

**Purpose:** portfolio artefact targeting a mine energy-management consultancy. Demonstrates that the builder understands underground field constraints *and* the energy engineering behind the numbers.
**Build time:** one week. Not more.
**Written:** 3 September 2026

---

## 1. Why this problem

Evidence, all from published South African mining research:

- Compressed air is the largest single portion of the electricity cost of a typical deep-level platinum mine, and contributes roughly 20% of total electrical energy consumption on a mine.
- Leakage accounts for as much as 35% of the energy losses of a compressed air network.
- Some mines still use the **"walk and listen" method** to identify leaks.
- Compressed air is frequently misappropriated for unregulated underground "self-ventilation" — crews opening pipelines to get airflow where ventilation is short.
- Documented interventions: ~0.9 MW average power reduction worth about R6.3 million a year from reducing refuge bay air usage; roughly R146,000 per day of wastage measured on a single shaft.

"Walk and listen" is a person underground, no signal, wearing gloves, recording findings on paper and typing them up later if they remember. That is precisely the workflow described in a practitioner's account of the work, applied to the work they personally did for three years before founding a consultancy.

---

## 2. What the tool is

Two screens with different jobs.

**Screen A — Underground (offline, primary)**
A level plan loads first. Tap where the leak is. Tap what kind. Save. Three taps, gloves on, no signal.

**Detection is still walk-and-listen (or an ultrasonic detector where the crew carries one) — this tool does not automate detection.** That would require continuous acoustic sensors wired underground, which is a different and much larger project. What Screen A replaces is the step after detection: "typed up later, if someone remembers" becomes logged on the spot. Since the person has no flow meter in the field, they select the closest description of what they heard or saw from the leak-type catalogue (section 4), and the tool infers an equivalent orifice size from that. Section 4 also provides an override field for a measured diameter or a detector dB reading, for crews that carry one.

**Screen B — Surface (online)**
The leak register, ranked by rand per year. Total system loss. Repair status. Export.

Screen A proves you understood the field. Screen B proves you're an engineer. Both are needed.

---

## 3. The calculation layer

This is the part a developer cannot build, and the reason to build it at all.

### 3.1 Leak mass flow — choked orifice

Mine reticulation typically runs at 400–500 kPa gauge. Venting to atmosphere gives a pressure ratio well below the critical value of 0.528 for air, so flow through a leak is **choked** and independent of downstream conditions.

```
ṁ = 0.0404 · Cd · A · P₁ / √T₁
```

Where ṁ is kg/s, A is orifice area in m², P₁ is absolute upstream pressure in Pa, T₁ is upstream absolute temperature in K.

The constant comes from `√(k/R) · (2/(k+1))^((k+1)/(2(k−1)))` with k = 1.4 and R = 287 J/kg·K.

Discharge coefficient: use 0.61 for a sharp-edged hole, 0.8 for a rounded or nozzle-like opening, 1.0 for a fully open line. Make it configurable, don't hard-code.

### 3.2 Compressor power

Provide **both** methods and show them side by side. This is a deliberate design choice, not indecision.

**Theoretical** — multi-stage with intercooling, per stage:

```
W = ṁ · (n/(n−1)) · R · T₁ · [ (P₂/P₁)^((n−1)/n) − 1 ] / η
```

Use n ≈ 1.35 for a cooled compression path, and a stated isentropic efficiency.

**Empirical** — specific power in kW per unit of free air delivered, taken from the mine's own compressor performance data. Where a site figure is available it beats the theoretical number, and the tool should say so.

Defaults must be editable inputs on a settings screen, never constants in the source.

### 3.3 Cost

```
Annual cost = kW × operating hours × tariff
```

Support **time-of-use tariff structure** — peak, standard and off-peak, with high and low demand seasons. Mines run continuously, so a leak costs different amounts at different hours, and a single blended rate understates the value of leaks in continuously pressurised sections.

Do not embed tariff values in code. They change annually and inventing them would be worse than leaving them blank.

### 3.4 The honest caveat that makes this credible

**Summed leak power is not realised saving.**

Fixing a leak only saves money if the compressor responds — unloading, reducing guide vane position, or being switched off. If it doesn't, the air that was leaking simply raises system pressure and power draw barely moves. Worse, higher pressure increases flow through every remaining leak.

The tool must state this. Report **potential** loss, and flag that realisation depends on compressor control response.

Put this in the README and on the surface screen. An energy management engineer will look for it, and its absence is what separates a student project from an engineering one.

---

## 4. Input design — the field constraint

The person underground has no flow meter. Inputs must be observable, not measured.

**Leak type catalogue**, each with a default equivalent orifice diameter, selected from an icon grid:

| Type | Typical equivalent diameter | Notes |
|---|---|---|
| Pinhole in hose | ~1 mm | |
| Failed hose coupling | ~3 mm | Most common |
| Valve gland / packing | ~2 mm | |
| Damaged flexible hose | ~6 mm | |
| Missing blank / open branch | ~12 mm | |
| Drill rig connection | ~4 mm | |
| **Refuge bay self-ventilation** | open line | **Separate category** |
| Open line for cooling | open line | **Separate category** |

The last two are not leaks. They are deliberate open valves compensating for a ventilation shortfall, and the fix is a ventilation intervention, not a maintenance job. Categorising them separately is a domain signal worth more than a week of UI polish.

Allow an override field for measured diameter or an ultrasonic detector dB reading where the crew has one.

### Uncertainty

**Report ranges, never false precision.** "1.5–3.2 kW, R48,000–R102,000 per year" is correct. "R73,412.88 per year" is a lie dressed as an answer, and it will be read as one.

Derive the band from the equivalent-diameter uncertainty of the selected leak class.

---

## 5. Field UX constraints

Every one of these traces to a practitioner's account of the work.

- **Map loads first.** Not a login, not a menu, not a dashboard.
- **Three taps to log:** location on plan → leak type → save. Severity and photo optional.
- **No GPS.** There is no satellite signal underground. Location is a tap on a level plan, referenced to survey pegs or pipe sections. This constraint is non-negotiable and getting it right is a strong signal.
- **Gloves.** Minimum 48px touch targets, generous spacing.
- **Dark, high contrast.** Cap lamp and a phone screen in a dark drive.
- **Visible sync queue.** The user must see what's pending. Silent queues destroy trust in offline apps.
- **Nothing blocks on network.** No spinner ever waits on a request.

---

## 6. Tech stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | React + TypeScript + Vite | Fast, standard, typed calculations |
| Map | Leaflet with `CRS.Simple` | Image-coordinate overlay for a level plan, not geographic coordinates |
| Storage | IndexedDB via **Dexie.js** | Raw IndexedDB is unpleasant; Dexie is not |
| Offline | Workbox service worker, PWA manifest | Installable, works from cold start with no signal |
| Charts | Recharts | Surface screen only |
| Calculations | Plain TypeScript module, unit tested | The showpiece — keep it isolated and readable |
| Backend | **None in v1** | A stub sync endpoint is enough |

If a backend is added later: FastAPI plus Postgres, with a sync endpoint accepting a batch of queued records and returning accepted IDs.

**Cutting the backend is a deliberate decision, not a shortcut.** It proves the constraint that mattered was the field, not the server. Say so in the README.

---

## 7. Data model

```ts
interface LeakRecord {
  id: string;              // UUID generated client-side
  levelId: string;
  x: number;               // image coordinates on the level plan
  y: number;
  leakTypeId: string;
  equivalentDiameterMm: number;   // default from type, user-overridable
  linePressureKpaG: number;       // default from level, user-overridable
  isDeliberateOpenLine: boolean;  // self-ventilation flag
  note?: string;
  photoBlob?: Blob;
  loggedAt: string;        // ISO, device clock
  loggedBy: string;
  syncStatus: 'pending' | 'synced' | 'failed';
  repairStatus: 'open' | 'scheduled' | 'repaired' | 'verified';
}
```

Client-side UUIDs matter: records are created with no server available, so the device must own identity.

---

## 8. Build order

**Day 1** — Calculation module and its tests. Nothing else. Hand-verify one leak against the equations before writing a single component.

**Day 2** — Level plan map with Leaflet `CRS.Simple`, tap to place a marker.

**Day 3** — Leak type picker, record creation, Dexie persistence. Three-tap flow working.

**Day 4** — Service worker, PWA install, offline cold start, visible sync queue.

**Day 5** — Surface screen: register ranked by rand per year, system totals, CSV export.

**Day 6** — Settings screen for tariff, compressor specific power, discharge coefficients. Photo capture if time allows.

**Day 7** — README. Deploy. Send it.

**Stop on day 7 regardless of state.** A rough tool sent on time beats a polished one sent after the role is filled.

---

## 9. Explicitly out of scope

Authentication. Multi-tenancy. Real mine GIS. Ultrasonic detector integration. Work order dispatch. Any AI or ML. Native apps. A backend.

Each of these adds a week and demonstrates nothing further.

---

## 10. The README is half the deliverable

Sections it must contain:

1. The problem, with the walk-and-listen citation
2. The choked orifice derivation, stated plainly
3. Compressor power — both methods and when each applies
4. **Why summed leak power is not realised saving**
5. Uncertainty treatment and why ranges are reported
6. Field constraints and the design decision each one drove
7. What would be needed from a real mine to trust the output — compressor curves, actual line pressures, level plans, tariff schedule
8. Known limitations, honestly listed

Point 4 and point 8 are what a reviewer with three years of energy management experience will look for first.

---

## 11. Known limitations to state openly

- The orifice model overestimates flow through long or tortuous leak paths
- Equivalent diameter inferred from a leak-type catalogue is crude; ultrasonic measurement is materially better
- Compressor specific power varies with loading; part-load operation carries an efficiency penalty not captured by a single figure
- Leak losses are not additive with respect to realised saving, per section 3.4
- Device clock drift affects timestamps on a shift with no network