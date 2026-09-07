# DECISIONS.md

Append a line whenever a non-obvious choice is made. On day 7 the README's
"design decisions" and "known limitations" sections are assembled from here,
which is why writing it down as you go costs nothing and saves an hour at the
worst possible moment.

Format: **Decision** — reason — what it costs.

---

## Already decided (from the spec)

**No backend in v1** — the constraint that mattered was the field, not the
server. A sync endpoint stub proves the queue design without a week of API work.
Costs: no multi-device register, no real sync. Say so explicitly in the README —
an unexplained missing backend reads as a shortcut, an explained one reads as a
decision.

**Both compressor power methods shown side by side** — theoretical polytropic
and empirical specific power answer different questions. The theoretical one
works with no site data; the empirical one is more trustworthy when a site
figure exists. Averaging them would hide which is which.

**Self-ventilation and open cooling lines are a separate category** — they are
deliberate open valves compensating for a ventilation shortfall. The fix is a
ventilation intervention, not a maintenance job. Merging them into the leak
total would produce a maintenance backlog full of items maintenance cannot fix.

**Ranges, not point values** — equivalent diameter is inferred from a leak-type
catalogue, so the input carries real uncertainty. Flow scales with d², so the
output band is wider than the input band. A figure to two decimal places would
be a false claim about the input data.

**Potential loss, not realised saving** — fixing a leak only saves energy if the
compressor responds. If it does not, the recovered air raises system pressure
and power draw barely moves, while higher pressure increases flow through every
remaining leak. The tool reports potential and flags the dependency.

**Tariff and compressor specific power default to null** — inventing a tariff
rate would be worse than leaving it blank. A blank field asks a question; a
plausible fabricated number gets believed.

**No GPS** — there is no satellite signal underground. Location is a tap on a
level plan referenced to survey pegs or pipe sections.

**Client-generated UUIDs** — records are created with no server available, so
the device must own identity.

**Detection is not automated** — the tool replaces the "typed up later, if
someone remembers" step, not the walk-and-listen step. Automating detection
needs continuous acoustic sensors wired underground, which is a different and
much larger project.

---

## Tooling decisions

**Vercel as the only deploy target, connected on day 1** — an HTTPS URL is
required to install a PWA on a real phone, and the real phone in airplane mode
is the only honest offline test. Connecting the empty scaffold on day 1 costs
ten minutes; discovering on the evening of day 4 that there is nowhere to
install from costs an evening. Two deploy targets would be two things that can
break, so GitHub Pages is not used.

**Static build only, no `api/` directory** — Vercel makes it trivially easy to
add a serverless function, which is exactly why it needs saying. Adding one
would contradict the stated "no backend" decision above and turn a deliberate
choice into an inconsistency a reviewer would notice.

**Work on `main`** — branch previews and pull requests are useful on a team and
are pure overhead on a seven-day solo build.

---

## Decided during the build

<!-- Append below. Date, decision, reason, cost. -->

**2026-09-07 — Scaffolded in place, not into a nested `air-leak-survey/`
folder** — `PLAN.md`'s Phase 0 command creates a new subdirectory, but the
repo already existed at this root with `CLAUDE.md` and the memory files
committed there. Scaffolding into a temp directory and moving the generated
files up avoids a redundant nested repo root. Costs nothing; the app name
inside `package.json` is still `air-leak-survey`.

**2026-09-07 — Dropped `oxlint` from the scaffold** — the current Vite
react-ts template bundles `oxlint` as a default dev dependency and `lint`
script. It isn't in the approved stack (`CLAUDE.md`: React, TypeScript, Vite,
Vitest, Leaflet, Dexie, Workbox, Recharts — anything else needs a stated
reason). Removed rather than silently kept. Costs nothing; can be reconsidered
later if lint errors become a real problem, with the day-cost stated then.

**2026-09-07 — Renamed the unborn branch from `master` to `main` before the
first commit** — `CLAUDE.md` says to work on `main`; git still defaults new
repos to `master` locally. Free to do before any commits existed.