# CLAUDE.md

Project memory. Read at the start of every session. Keep under 200 lines.

## What this is

An offline-first PWA for logging compressed air leaks underground on a deep-level
mine, and costing them in rand per year. Portfolio artefact. One week, then it
ships regardless of state.

Full spec: `compressed-air-leak-tool-spec.md` in the repo root. Read it before
proposing anything structural.

The author is a chemical engineer. He writes Python well and TypeScript less
often. Explain TypeScript and React idioms briefly the first time they appear.
Do not explain thermodynamics, compressed air systems, or mining to him.

## Current phase

<!-- Update this line at the start of every session. It is the scope fence. -->

**Phase 7 — README and ship.**

Work on the current phase only. If a task belongs to a later phase, say which
phase it belongs to and do not write it. Scope creep is the expected failure
mode of this project.

## Hard engineering rules

1. **Physics lives in one place.** Everything in `src/calc/` is pure TypeScript.
   No React import, no Dexie import, no `fetch`, no `localStorage`, no `Date.now()`
   inside a calculation. Functions take inputs and return outputs. This folder
   will be read by an engineer evaluating the author's work, so it must
   read like engineering to someone who does not write TypeScript.
2. **No magic numbers.** Discharge coefficients, polytropic exponent, gas
   constant, compressor specific power, tariff rates, line pressures, operating
   hours — all named exports in `src/calc/constants.ts`, each with a source
   comment saying where the number came from. All overridable from settings.
3. **Unknown means null.** If a real value is unavailable (tariff rates,
   site-specific compressor performance), the constant is `null` and the UI asks
   for it. Never invent a tariff rate or a compressor figure. A plausible
   fabricated number is worse than a blank field.
4. **Ranges, not point values.** Every energy and cost output is a
   `{ low, expected, high }` band derived from equivalent-diameter uncertainty.
   A single number to two decimal places is a defect in this project.
5. **Client-owned identity.** UUIDs are generated on the device with
   `crypto.randomUUID()`. A record is complete and valid with no server present.
6. **Nothing blocks on network.** No component may `await` a request in order to
   render. If you write code that does, flag it and fix it.
7. **Tests before implementation** in `src/calc/`. Write the failing test first.

## Field constraints — non-negotiable

These come from field reality, not taste. If a proposed change breaks one,
refuse and name the constraint.

- The map renders first. Not a login, not a menu, not a dashboard.
- Three taps to log a leak: position, type, save. Severity and photo optional.
- Touch targets at least 48px with generous spacing. The user is wearing gloves.
- Dark, high contrast. A cap lamp and a phone screen in a dark drive.
- **No GPS.** There is no satellite signal underground. Location is image
  coordinates on a level plan via Leaflet `CRS.Simple`. Never geographic
  coordinates, never `navigator.geolocation`.
- The sync queue is always visible with a pending count. Silent queues destroy
  trust in offline apps.

## Domain rules

- **Self-ventilation and deliberate open lines are a separate category from
  leaks.** Never merge them into the leak grid, never total them into the leak
  total. They are a ventilation shortfall with a ventilation fix, not a
  maintenance job. Keeping them distinct is a deliberate domain signal.
- **Summed leak power is potential, not realised, saving.** Realisation depends
  on whether the compressor responds — unloading, guide vane position, or being
  switched off. This caveat appears on the surface screen and in the README. Do
  not remove it for looking untidy.

## Stack — do not add to it

React, TypeScript, Vite, Vitest, Leaflet, Dexie, Workbox, Recharts.

Anything else requires stating why and what it costs in days. No UI component
library. No state management library — React state is enough for this.

## Out of scope — decline and cite this line

Authentication. Multi-tenancy. Real mine GIS. Ultrasonic detector integration.
Work order dispatch. Any AI or ML. Native apps. A backend. Each adds a week and
demonstrates nothing further.

"A backend" includes Vercel serverless functions. An `api/` directory is a
backend regardless of how little code is in it, and adding one contradicts the
stated design decision in the README.

Cutting the backend is a deliberate decision, not a shortcut. It proves the
constraint that mattered was the field, not the server.

## Commands

```
npm run dev        # dev server
npm run test       # vitest
npm run typecheck  # tsc --noEmit
npm run build      # production build
npm run preview    # serve the build — required to test the service worker
```

The service worker does not run under `npm run dev`. Offline testing happens
against `npm run preview` locally, or against the deployed URL on a real phone.

## Environment and deploy

- **IDE:** PyCharm Professional. It has full TypeScript, React and Vitest
  support. Right-click a `*.test.ts` file to create a Vitest run configuration.
  IndexedDB contents and service worker state are not visible in PyCharm — use
  Chrome DevTools → Application for both.
- **Deploy target:** Vercel, connected to the GitHub repo. Vercel auto-detects
  Vite; no build configuration is needed. Pushes to `main` deploy to production.
- **Work on `main`.** Branches and PR previews are ceremony this project does
  not have time for.
- Vercel is connected on day 1 with the empty scaffold, not on day 7. An HTTPS
  URL is required to install the PWA on a real phone, which is the only honest
  offline test.
- No environment variables. Nothing in this app has a secret.

## Working style

- Write complete files, not fragments. When changing an existing file, give the
  whole file or a precise diff.
- Ask at most one clarifying question, then proceed on a stated assumption.
- If a task would take more than half a day, say so and offer a smaller version.
- If the spec and a request conflict, say so rather than silently following
  either.
- Update `TODO.md` when a task completes. Append to `DECISIONS.md` whenever a
  non-obvious choice is made — the README is assembled from it on day 7.