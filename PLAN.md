# PLAN.md

Seven days. Each phase has an exit gate. Do not start a phase until the previous
gate passes. Ship on day 7 regardless of state.

---

## Phase 0 — Repo skeleton (day 1, 30 minutes)

```
npm create vite@latest air-leak-survey -- --template react-ts
cd air-leak-survey
npm install
npm install -D vitest
npm install leaflet react-leaflet dexie recharts
npm install -D @types/leaflet
```

Add to `package.json` scripts: `"test": "vitest"`, `"typecheck": "tsc --noEmit"`.

Strip the Vite demo content out of `App.tsx` — leave a single empty div. Copy
`CLAUDE.md`, `PLAN.md`, `TODO.md`, `DECISIONS.md` and the spec into the root.
`git init`, commit, push to GitHub.

Then connect Vercel: import the GitHub repo at vercel.com, deploy the empty
scaffold. Vercel detects Vite and needs no build configuration. Ten minutes now,
and then ignored until Phase 4 — but an HTTPS URL has to exist before the
offline test on day 4, and setting up a deploy pipeline that evening while
debugging a service worker is how days get lost.

**Gate:** `npm run test` runs, `npm run typecheck` is clean, and the empty app
loads from a `*.vercel.app` URL.

Workbox and the PWA plugin are installed in Phase 4, not now. No `api/`
directory, now or later — see the out-of-scope note in `CLAUDE.md`.

---

## Phase 1 — Calculation module (day 1, the rest of it)

The showpiece. No UI exists at the end of this day and that is correct.

### Files

```
src/calc/
  constants.ts     named constants, each with a source comment; nulls for unknowns
  types.ts         LeakInput, Range, LeakResult, TariffSchedule, CompressorSpec
  orifice.ts       choked mass flow through a sharp-edged orifice
  compressor.ts    theoretical polytropic power AND empirical specific power
  cost.ts          time-of-use annual cost from a power figure
  uncertainty.ts   propagates the equivalent-diameter band through to cost
  index.ts         evaluateLeak() — the single public entry point
  *.test.ts        one test file per module
HANDCHECK.md       one leak worked by hand, matching a test in the suite
```

### Steps

1. `constants.ts` and `types.ts`. Constants first because everything else
   depends on not inventing numbers. `TARIFF` and `COMPRESSOR_SPECIFIC_POWER`
   start as `null`.
2. `orifice.test.ts`, then `orifice.ts`. Choked flow:
   `ṁ = 0.0404 · Cd · A · P₁ / √T₁`. Include an explicit check that the pressure
   ratio is below the critical value of 0.528 and a documented behaviour when it
   is not — a mine line at 400–500 kPa(g) venting to atmosphere is always
   choked, but the function should not silently return a wrong answer if
   someone passes it a low-pressure case.
3. `compressor.test.ts`, then `compressor.ts`. Both methods, returned side by
   side, never averaged. The empirical result is marked as preferred when a site
   specific-power figure is present.
4. `cost.test.ts`, then `cost.ts`. Time-of-use: peak, standard, off-peak across
   high and low demand season. Returns `null` — not zero — if no tariff is set.
5. `uncertainty.test.ts`, then `uncertainty.ts`. A diameter band in, a cost band
   out. Note that flow goes with d², so a ±30% diameter band is roughly a
   ±70% flow band — the arithmetic should make that visible rather than hide it.
6. `index.ts` — `evaluateLeak(input, settings): LeakResult`. One call, ranges out.
7. `HANDCHECK.md` — 3 mm coupling, 500 kPa(g), Cd 0.61, 20 °C. Work it through
   in writing, then assert the same case in `index.test.ts`.

**Gate:** all tests pass, `HANDCHECK.md` agrees with the code to the stated
precision, no file in `src/calc/` imports React or touches I/O.

---

## Phase 2 — Level plan map (day 2)

1. Placeholder level plan PNG in `public/plans/` with known pixel dimensions.
   A hand-drawn schematic is fine; a real mine plan is not available and is not
   needed.
2. `MapScreen.tsx` — Leaflet with `CRS.Simple` and `imageOverlay`, bounds set
   from the image pixel dimensions.
3. Tap places a marker; coordinates stored as image x/y in component state.
4. Dark tile-free background, high contrast marker.

**Testing:** Chrome DevTools device toolbar at a phone size. Emulation is
adequate for coordinates and touch target sizing.

**Gate:** tapping the plan places a marker at the tapped point and the reported
coordinates are image coordinates, not lat/lng.

---

## Phase 3 — Capture flow and persistence (day 3)

1. `db.ts` — Dexie schema for `LeakRecord` as specified in spec section 7.
2. `LeakTypePicker.tsx` — icon grid, one tile per catalogue entry, 48px minimum,
   and the two open-line categories in a visually separate group below the leaks.
3. Save writes to Dexie with `crypto.randomUUID()` and `syncStatus: 'pending'`.
4. Three-tap flow wired end to end: tap plan → tap type → tap save.
5. Optional override field for measured diameter or detector dB, collapsed by
   default so it does not sit in the three-tap path.

**Testing:** DevTools → Application → IndexedDB to inspect stored records. Tap
the whole flow with the flat of a thumb or a knuckle — the gloves proxy. It will
find at least one target that is too small.

**Gate:** log a leak, reload the browser, the leak is still there.

This is the first milestone worth demonstrating to anyone.

---

## Phase 4 — Offline (day 4)

1. `npm install -D vite-plugin-pwa` (wraps Workbox), configure precaching of the
   app shell and the level plan images.
2. PWA manifest: name, icons, `display: standalone`, dark theme colour.
3. `SyncQueueBadge.tsx` — pending count, always visible on the map screen.
4. Stub sync: a function that attempts a POST and marks records `synced` or
   `failed`. It must never block a render and must fail quietly to the queue.

**Testing, in this order:**

1. Locally: `npm run build && npm run preview`. The service worker does not run
   under `npm run dev`. Confirm DevTools → Application → Service Workers shows
   "activated and running", then tick Network → Offline and hard reload.
2. On a real phone via the Vercel URL: install to home screen, enable
   **airplane mode**, open from the icon, log a leak. Airplane mode is the
   honest test — DevTools offline mode runs against a warm cache and will pass
   when the real thing fails.
3. Android Chrome is the smoother path; `chrome://inspect` over USB gives the
   phone's console. If the demo will be on iOS, test on iOS specifically —
   add-to-home-screen behaves differently enough to matter.

**Gate:** airplane mode, cold start from the home screen icon, log a leak. If
this fails, Phase 5 does not start.

---

## Phase 5 — Surface screen (day 5)

1. `RegisterScreen.tsx` — table sorted by expected R/year descending, every
   figure shown as a band.
2. System totals: total potential leak loss, and open-line/self-ventilation
   totalled separately with its own label.
3. One Recharts bar chart — loss by leak type. One chart, not a dashboard.
4. CSV export from Dexie, client-side blob download.
5. The realised-saving caveat rendered on the screen, not in a tooltip.
6. Repair status control: open / scheduled / repaired / verified.

**Gate:** register ranks correctly, caveat is visible without scrolling past the
totals, and the CSV opens in Excel with the ranges intact — check that a value
like `1.5-3.2` has not been silently converted to a date.

---

## Phase 6 — Settings (day 6)

1. `SettingsScreen.tsx` — tariff table (blank), compressor specific power
   (blank), discharge coefficients, line pressure per level, operating hours.
2. Persist settings to Dexie.
3. Blank tariff produces "tariff not set" in the register rather than R0.
4. Photo capture via `<input type="file" capture>` only if time remains.

**Gate:** changing specific power changes the register figures, and clearing the
tariff produces "tariff not set" rather than R0.

---

## Phase 7 — README and deploy (day 7)

README sections, in this order:

1. The problem, with the walk-and-listen citation
2. The choked orifice derivation, stated plainly
3. Compressor power — both methods and when each applies
4. **Why summed leak power is not realised saving**
5. Uncertainty treatment and why ranges are reported
6. Field constraints and the design decision each one drove
7. What real mine data would be needed to trust the output — compressor curves,
   actual line pressures, level plans, tariff schedule
8. Known limitations, honestly listed (spec section 11)

Points 4 and 8 are what a reviewer with three years of energy management
experience looks for first. Assemble sections 6 and 8 from `DECISIONS.md`.

Push to `main` — Vercel has been deploying since day 1, so this is a push, not a
deployment task. Confirm the production URL cold starts in airplane mode one
last time. Screenshot the three-tap flow. Send it.

**Stop on day 7 regardless of state.**