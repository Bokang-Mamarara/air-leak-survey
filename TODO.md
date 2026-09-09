# TODO.md

Tick as you go. Unticked items at the end of a day get carried or cut, never
allowed to push the ship date.

---

## Day 1 — Calculation module

- [x] Vite + React + TS scaffold, deps installed, demo content stripped
- [x] `test` and `typecheck` scripts, both running clean (`typecheck` clean now;
      `test` is wired but has no test files until Phase 1 starts)
- [x] Memory files and spec committed to repo root
- [x] Pushed to GitHub (github.com/Bokang-Mamarara/air-leak-survey, private)
- [x] Vercel connected to the repo, empty scaffold loading from `*.vercel.app`
      (https://air-leak-survey1.vercel.app/)
- [ ] PyCharm Vitest run configuration created (right-click a `*.test.ts`) —
      deferred to Phase 1, once a test file exists to right-click
- [x] `"strict": true` added to `tsconfig.app.json` — `null` means nothing without
      `strictNullChecks`, and rule 3 depends on it
- [x] `constants.test.ts` written and failing, then passing — 20 tests, including
      the two derived constants recomputed from k and R
- [x] `src/calc/constants.ts` — every number named, sourced, tariff and specific power `null`
- [x] `src/calc/types.ts` — `LeakInput`, `Range`, `LeakResult`, `TariffSchedule`, `CompressorSpec`
- [x] `orifice.test.ts` written and failing, then passing — 19 tests
- [x] `orifice.ts` — choked flow, critical ratio guard, Cd injected not hard-coded
- [x] `compressor.test.ts` / `compressor.ts` — theoretical and empirical, side by
      side — 23 tests. Hand calculation and code agree on 1.3748 kW for the
      hand-check leak
- [x] `cost.test.ts` / `cost.ts` — time-of-use, returns `null` when tariff unset
      — 19 tests. `HOURS_PER_YEAR` added to `constants.ts`, kept distinct from
      the operating-hours default
- [x] `uncertainty.test.ts` / `uncertainty.ts` — diameter band → cost band — 14
      tests. ±30% on diameter propagates to −51%/+69% on flow and stays there
- [x] `index.ts` — `evaluateLeak()` single entry point — 38 tests. Added
      `flowUnavailableReason` to `LeakResult` so a non-choked line reports the
      condition instead of throwing at the register
- [x] `HANDCHECK.md` — 3 mm coupling at 500 kPa(g) worked by hand. Agrees with
      the module to 6–8 significant figures on every quantity; d² propagation
      shown explicitly
- [x] Hand-check case asserted in `index.test.ts` and passing — 6.118 g/s,
      5.08 L/s, 1.3748 kW, 12 043 kWh/year
- [x] **Gate:** no React import, no I/O anywhere in `src/calc/` — every import
      in the module files is relative; the only external one is `vitest`, in
      test files only

## Day 2 — Level plan map

- [x] Placeholder level plan SVG drawn (`public/plans/level-24.svg`) and
      rasterized to PNG with known pixel dimensions (`level-24.png`, 2000×1200,
      constants in `src/map/planImage.ts`)
- [x] Leaflet `CRS.Simple` + `imageOverlay`, bounds from image size
- [x] Tap to place marker, image coordinates captured (`leafletPointToImageXY`,
      unit tested)
- [x] Dark high-contrast styling, no basemap tiles
- [x] `App.tsx` renders `MapScreen` directly — no menu, login, or route
- [x] **Gate:** coordinates are image x/y, never lat/lng — verified in browser
      (Vite preview): tap places/moves a single marker, readout panel shows
      the image x/y, double-click does not zoom

## Day 3 — Capture flow

- [x] Dexie schema matching spec section 7 (`src/data/db.ts`) — indexed on
      `levelId`, `syncStatus`, `repairStatus`
- [x] Leak type icon grid, 48px minimum targets (`src/capture/LeakTypePicker.tsx`)
- [x] Open-line / self-ventilation categories in a separate visual group —
      distinct border/background and heading, not just a filter
- [x] Save writes record with `crypto.randomUUID()` and `syncStatus: 'pending'`
      — construction isolated in `buildLeakRecord()`, unit tested (11 tests)
- [x] Three-tap flow working: position → type → save, for the six real leak
      types. The two open-line types need a fourth, required, non-collapsed
      "bore / nominal pipe size" step, logged in `DECISIONS.md` — the
      schema's non-nullable diameter and the catalogue's deliberate `null`
      for open lines cannot both be satisfied by a collapsed optional field
- [x] Collapsed override field for measured diameter and a note, behind
      "More detail"
- [x] Whole flow tapped in Chrome device-emulation at phone size — targets
      hold up; real-phone/glove check still pending
- [x] **Gate:** logged a leak and an open line, reloaded the browser in
      Chrome, both still on the plan, read back from IndexedDB and verified
      directly against the stored record shape
- [ ] First demonstrable milestone — show someone

## Day 4 — Offline

- [x] `vite-plugin-pwa` configured (`generateSW`, `registerType: 'prompt'`),
      app shell, `plans/level-24.png`/`.svg`, and Leaflet's bundled CSS
      precached — 20 entries, 565.66 KiB. `plans/level-24.png` confirmed by
      name in Cache Storage (`workbox-precache-v2-...`), not just inferred
      from the app loading offline
- [x] Manifest, icons, standalone display, dark theme colour — icons
      generated from `public/icons/icon-source.svg`, no Vite defaults left
- [x] Sync queue badge with pending count, always visible
      (`src/sync/SyncQueueBadge.tsx`) — `0 pending` shown even with nothing
      queued; failed count only rendered when nonzero
- [x] Stub sync function — never blocks a render, fails quietly to the queue
      (`src/sync/syncQueue.ts`); manual Retry only, no background loop
- [x] `npm run build && npm run preview` — service worker registration
      confirmed `active.state: 'activated'`
- [ ] DevTools Network → Offline, hard reload, app cold starts — not run;
      the browser tooling available this session has no network-throttling
      control. Cache Storage contents were verified directly instead (see
      above), which is the stronger check for the one asset that matters,
      but the actual offline-reload gate is still open
- [x] Installed to home screen from the Vercel URL on a real phone
- [x] Real-device findings (Android, landscape) — Leaflet's default zoom
      control (~30px) was below the 48px field constraint and sat under the
      x/y readout chip in the same corner. Replaced with
      `src/map/ZoomControl.tsx`, 48px buttons, moved to bottom-right — the
      one corner none of the other overlays use
- [x] Real-device findings — initial fit had large dead margins and
      illegible PS-xx labels. Cause: Leaflet's default `zoomSnap` (1) rounds
      the fitBounds zoom down to the nearest whole level, which can leave up
      to a full zoom level of unnecessary margin. `zoomSnap={0}` on
      `MapContainer` fixes it — confirmed via a local viewport harness at an
      exact 915×412 (phone landscape) size that the plan now fills the full
      viewport height with zero margin beyond what the image's own 5:3
      aspect ratio forces (114px each side, the mathematical minimum for
      that aspect combination)
- [x] Portrait checked (412×915 harness) — functional, no control overlaps,
      48px zoom buttons reachable bottom-right, but a landscape-shaped plan
      in a portrait frame is width-bound: most of the screen above and
      below the plan is unavoidably empty. That's inherent to the plan's
      aspect ratio, not a bug; see DECISIONS.md
- [x] Real-device regression (Android, portrait) — the plan overflowed
      horizontally, clipping both edges (SP-14/DRIVE A on the left, the
      legend on the right), so PS-01 and PS-08 needed panning to reach. The
      iframe viewport harness had reported portrait as fine; it wasn't
      measuring against the image's own content bounds, so a full-width
      clipped image looked the same as a full-width correctly-fit one.
      Cause: `minZoom={-2}` (added for the zoomSnap fix above) was tighter
      than the zoom a narrow portrait viewport needs to fit the plan by
      width, clamping the fit and zooming in past what the viewport could
      hold. Fixed properly, not with `"orientation": "landscape"` in the
      manifest — see DECISIONS.md for the two bugs that surfaced getting
      there and the final approach (`FitZoomFloor` + a generous static
      `minZoom={-10}` floor). Reconfirmed with the harness at both
      exact 915×412 and 412×915: landscape unchanged (114px margins each
      side, the aspect-ratio minimum), portrait now fits full-width with
      zero horizontal clipping
- [ ] **Gate:** airplane mode, cold start from the icon, log a leak — needs
      re-running once the fixes above are on Vercel

## Day 5 — Surface screen

- [x] Register sorted by expected R/year descending — `compareByLossDescending`
      in `src/calc/summarise.ts`: cost when the tariff makes it known, energy
      when it doesn't, so an unset tariff doesn't collapse the ranking to
      input order; a row with neither (an unchoked line) sinks to the bottom
- [x] Every figure displayed as a band, not a point value (`RegisterScreen.tsx`,
      `formatRange`/`formatZarRange`)
- [x] System total for leaks (`summary.leakTotals`)
- [x] Open-line / self-ventilation totalled separately with its own label —
      "Self-ventilation / open lines — not a leak", own section, never summed
      into the leak total
- [x] Two Recharts bar charts, one per category — "Loss by leak type" and
      "Loss by open-line type" (`LossByTypeChart`, reused). Originally one
      combined chart grouped by `summariseLeaks`' unfiltered record list,
      which put a self-ventilation bar on the same "leak type" axis as real
      leaks — caught during pre-sign-off review against a Vercel preview,
      fixed by splitting `LeakSummary.byLeakType` into `byLeakType` (leaks
      only) and a new `byOpenLineType` (see DECISIONS.md, 2026-09-09)
- [x] CSV export (`src/register/csv.ts`, `buildCsv`, unit tested). Every
      numeric cell is rounded at export — position to a whole pixel, power to
      three significant figures, energy/cost to a whole unit, diameter/bore
      to one decimal — clearing floating-point noise (`4.199999999999999` →
      `4.2`) and false precision (12-15 digit power/energy figures) an early
      pass had left in; `src/calc` itself is untouched, rounding stays a
      display/export concern. Also carries a "Band basis" column, worded from
      `diameterProvenance` — "catalogue equivalent diameter ±30%" versus
      "measured diameter, ±30% assumed" — since a measured override and a
      catalogue default get the same band width but are different claims
      about where the number came from; `LeakRecord`/`buildLeakRecord.ts`
      gained the field to make that distinction possible at all (DECISIONS.md,
      2026-09-08 entries)
- [ ] CSV opened in Excel — ranges intact, not converted to dates — code
      guards against this (low/expected/high as three separate numeric
      columns, never a hyphenated `"1.5-3.2"` string; see `csv.ts`'s module
      doc), unit tested including the rounding above, but not yet opened in
      an actual copy of Excel — that check is the user's to make before the
      phase closes
- [x] Realised-saving caveat visible on screen, not in a tooltip —
      `REALISED_SAVING_CAVEAT`, first section under the leak total, before any
      scrolling; rendering not yet eyeballed by the user, who wants to see it
      before the phase closes
- [x] Repair status control (`RegisterTable`'s status `<select>`, writes
      through to `db.leakRecords`)

**Gate:** register ranks correctly (verified — `summarise.test.ts`), caveat is
visible without scrolling past the totals (verified in code, not yet by eye),
CSV opens in Excel with the ranges intact (verified by unit test against the
column shape, not yet by actually opening a file in Excel). The two "not yet"
items are what the user is checking before Phase 5 closes.

## Day 6 — Settings

- [x] "Clear all records" control — wipes `db.leakRecords` for the device,
      landed first as asked. `window.confirm` names the live record count
      (via `liveQuery`) before deleting; settings table untouched, verified
      by construction (separate Dexie table, only `leakRecords.clear()` is
      called)
- [x] Tariff table, blank by default — 12 rate/hours fields + source, all
      empty until every one validates (`tryBuildTariff`, `tariffDraft.ts`,
      13 tests). A half-filled tariff persists as a *draft*, separate from
      `CalcSettings.tariff`, so navigating away doesn't discard it —
      verified live: typed one rate, reloaded the whole app, the draft and
      its "1 of 12 rates entered" progress line were both still there
- [x] Compressor specific power, blank by default — plus source,
      isentropic efficiency, polytropic exponent, stage count, discharge
      pressure, inlet temperature
- [x] Discharge coefficients (sharp-edged, open line), line pressure,
      operating hours, diameter uncertainty fraction. Sharp-edged/open-line
      controls state which catalogue entries they affect and name the one
      leak type (`missing-blank-open-branch`) deliberately excluded — group
      membership computed from `LEAK_TYPE_CATALOGUE`, not hand-typed
      (`dischargeCoefficientGroups.ts`, 7 tests)
- [x] Atmospheric pressure and the open-line coefficient uncertainty
      fraction — collapsed under "Advanced", not hidden as unsupported
- [x] Settings persisted to Dexie (`settings` table, version 2,
      `src/data/settingsStorage.ts`), loaded non-blocking — map still
      renders first, `DEFAULT_CALC_SETTINGS` applies until the stored row
      arrives
- [x] Blank tariff shows "tariff not set", never R0 — unchanged register
      behaviour, now reading a real (possibly still-null) `settings.tariff`
      instead of the hardcoded default
- [x] **Gate:** changing specific power changes the register figures —
      verified live in Chrome against `npm run preview`: set specific
      power to 6 in Settings, the register's Power column and tooltip
      switched from "Theoretical polytropic…" to "Site compressor data, 6
      kW per m3/s…" immediately, and survived a full page reload
- [ ] Photo capture — not started, no time left in the day's budget

## Day 7 — README and ship

- [ ] README sections 1–8 per `PLAN.md`
- [ ] Realised-saving section written properly, not in a bullet
- [ ] Known limitations from spec section 11
- [ ] What real mine data would be needed
- [ ] Push to `main`, confirm production build is green on Vercel
- [ ] Final airplane-mode cold start against the production URL
- [ ] Screenshots of the three-tap flow
- [ ] **Send it**

---

## Cut list

If a day overruns, cut from here first, in this order:

1. Photo capture
2. Recharts chart (the ranked table carries the argument on its own)
3. Repair status control
4. Override field for measured diameter
5. PWA install icons beyond one size

Never cut: the uncertainty bands, the separate self-ventilation category, the
realised-saving caveat, the offline cold start. Those four are the project.