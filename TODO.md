# TODO.md

Tick as you go. Unticked items at the end of a day get carried or cut, never
allowed to push the ship date.

---

## Day 1 — Calculation module

- [ ] Vite + React + TS scaffold, deps installed, demo content stripped
- [ ] `test` and `typecheck` scripts, both running clean
- [ ] Memory files and spec committed to repo root
- [ ] Pushed to GitHub
- [ ] Vercel connected to the repo, empty scaffold loading from `*.vercel.app`
- [ ] PyCharm Vitest run configuration created (right-click a `*.test.ts`)
- [ ] `src/calc/constants.ts` — every number named, sourced, tariff and specific power `null`
- [ ] `src/calc/types.ts` — `LeakInput`, `Range`, `LeakResult`, `TariffSchedule`, `CompressorSpec`
- [ ] `orifice.test.ts` written and failing
- [ ] `orifice.ts` — choked flow, critical ratio guard, Cd injected not hard-coded
- [ ] `compressor.test.ts` / `compressor.ts` — theoretical and empirical, side by side
- [ ] `cost.test.ts` / `cost.ts` — time-of-use, returns `null` when tariff unset
- [ ] `uncertainty.test.ts` / `uncertainty.ts` — diameter band → cost band
- [ ] `index.ts` — `evaluateLeak()` single entry point
- [ ] `HANDCHECK.md` — 3 mm coupling at 500 kPa(g) worked by hand
- [ ] Hand-check case asserted in `index.test.ts` and passing
- [ ] **Gate:** no React import, no I/O anywhere in `src/calc/`

## Day 2 — Level plan map

- [ ] Placeholder level plan PNG with known pixel dimensions
- [ ] Leaflet `CRS.Simple` + `imageOverlay`, bounds from image size
- [ ] Tap to place marker, image coordinates captured
- [ ] Dark high-contrast styling, no basemap tiles
- [ ] **Gate:** coordinates are image x/y, never lat/lng

## Day 3 — Capture flow

- [ ] Dexie schema matching spec section 7
- [ ] Leak type icon grid, 48px minimum targets
- [ ] Open-line / self-ventilation categories in a separate visual group
- [ ] Save writes record with `crypto.randomUUID()` and `syncStatus: 'pending'`
- [ ] Three-tap flow working: position → type → save
- [ ] Collapsed override field for measured diameter or dB
- [ ] Whole flow tapped with the flat of a thumb — the gloves proxy
- [ ] **Gate:** reload the browser, the leak is still there
- [ ] First demonstrable milestone — show someone

## Day 4 — Offline

- [ ] `vite-plugin-pwa` configured, app shell and plan images precached
- [ ] Manifest, icons, standalone display, dark theme colour
- [ ] Sync queue badge with pending count, always visible
- [ ] Stub sync function — never blocks a render, fails quietly to the queue
- [ ] `npm run build && npm run preview` — service worker shows "activated and running"
- [ ] DevTools Network → Offline, hard reload, app cold starts
- [ ] Installed to home screen from the Vercel URL on a real phone
- [ ] **Gate:** airplane mode, cold start from the icon, log a leak

## Day 5 — Surface screen

- [ ] Register sorted by expected R/year descending
- [ ] Every figure displayed as a band, not a point value
- [ ] System total for leaks
- [ ] Open-line / self-ventilation totalled separately with its own label
- [ ] One Recharts bar chart — loss by leak type
- [ ] CSV export
- [ ] CSV opened in Excel — ranges intact, not converted to dates
- [ ] Realised-saving caveat visible on screen, not in a tooltip
- [ ] Repair status control

## Day 6 — Settings

- [ ] Tariff table, blank by default
- [ ] Compressor specific power, blank by default
- [ ] Discharge coefficients, line pressure per level, operating hours
- [ ] Settings persisted to Dexie
- [ ] Blank tariff shows "tariff not set", never R0
- [ ] Photo capture — only if time remains

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