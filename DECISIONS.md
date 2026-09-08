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

**2026-09-07 — Repo created private, Vercel connected via dashboard import,
not CLI** — `gh repo create` was fine for GitHub (device-code browser flow
completes non-interactively once approved). The Vercel CLI's `vercel login`
is a TUI menu with no equivalent non-interactive flag, so it hangs when
driven from a tool call. Importing the repo directly at vercel.com sidesteps
that and is exactly what `PLAN.md` already specified — no cost, just skipped
the CLI detour. Repo is private for now (portfolio piece, not yet in
presentable shape); flip to public later from GitHub settings.

**2026-09-07 — `"strict": true` added to `tsconfig.app.json`** — the Vite
react-ts scaffold shipped without it. Without `strictNullChecks` the decision
to make tariff and compressor specific power `null` is unenforceable: TypeScript
would let a null flow into arithmetic and produce `NaN` silently, which is the
exact failure mode the null was chosen to prevent. The whole "unknown means
null" rule rests on this flag. Costs nothing; done before any source existed.

**2026-09-07 — Compressor assumptions are settings inputs, not bare constants**
— isentropic efficiency (0.75), polytropic exponent (1.35) and stage count (2)
all live on `CompressorSpec` with the constants file supplying only the starting
values. The theoretical method exists precisely for the case where no site data
is available, so the first thing anyone with compressor experience will do is
push efficiency to 0.70 and see what moves. Making that a settings edit rather
than a source edit costs five minutes now. Each estimate carries a `basis`
string — "theoretical, eta = 0.75 assumed" — so the assumption is visible on
screen next to the figure rather than buried in a comment.

**2026-09-07 — Non-choked flow throws rather than computing a subsonic answer**
— a mine line at 400–500 kPa(g) venting to atmosphere sits at a pressure ratio
of about 0.17 against a critical value of 0.528, so it is always choked.
Implementing the subsonic compressible orifice equation would add a branch that
can never run on real inputs. The function checks the ratio before computing and
throws an error worded as an engineering statement — "Pressure ratio 0.61
exceeds the critical value of 0.528; flow is not choked. This tool models choked
flow only." — because the person most likely to encounter it is reading the code
rather than running it, and the message is where the boundary of the model gets
stated. Costs: the tool cannot cost a low-pressure system. Listed as a
limitation.

**2026-09-07 — Uniform ±30% diameter band, not per-type bands** — a pinhole is
arguably proportionally more uncertain than a 12 mm open branch, but there is no
data to set six different bands from, so per-type figures would be six invented
numbers dressed as precision. One documented judgement figure is honest about
what it is. `LeakTypeDefinition` has room for a per-type override when real
measurement data justifies one. `HANDCHECK.md` shows the d² propagation
explicitly: ±30% on diameter is about −51%/+69% on flow.

**2026-09-07 — Open-line equivalent diameters are `null`, not a nominal bore** —
spec section 4 writes "open line" rather than a number for the two
self-ventilation categories, and it is right to. The diameter is the bore of
whatever branch was opened, which only the person standing in front of it knows.
`evaluateLeak` returns null bands and names the missing field in
`unresolvedInputs` rather than assuming, say, 25 mm. Costs: those two types
cannot be costed from a single tap. That is the honest answer.

**2026-09-07 — The realised-saving caveat is one exported constant, not a field
on every result** — it is a property of the method, not of any individual leak.
The surface screen and the README both import the same string, so they cannot
drift apart, and it does not bloat every stored record.

**2026-09-07 — `CalcSettings` lives in `types.ts` and `DEFAULT_CALC_SETTINGS` in
`constants.ts`, not in `index.ts`** — small deviation from the file list in
`PLAN.md`. Defaults are constants and belong with the constants; `index.ts` stays
what it is meant to be, a single public entry point with no data of its own.

**2026-09-07 — `summariseLeaks()` belongs in `src/calc`, not in a component** —
deferred to Phase 5 because nothing consumes it until the register exists, but
when it is written it goes in the calculation layer. Separating the leak total
from the open-line total is a domain rule, not a display concern, and a rule
enforced in a component is a rule that gets broken by the next component. It
returns two named buckets with no combined field, the same way `LeakResult.power`
holds the two compressor methods with nowhere to put an average.

**2026-09-07 — `chokedMassFlowKgPerS` takes a downstream pressure it does not
use in the equation** — looks redundant, and is the point. Once the flow is
choked the throat is sonic and nothing downstream can signal back upstream, so
downstream pressure cannot appear in the mass flow term. It is required as an
input so the function can *prove* that assumption holds before relying on it,
which is the difference between an equation that is valid and an equation that
happens to be applied. A test asserts that two different downstream pressures,
both below critical, return byte-identical mass flows while reporting different
pressure ratios — the defining property of choked flow, stated as an
executable claim rather than a comment.

**2026-09-07 — Compressor discharge pressure defaults to the same figure as the
line pressure at the leak, which understates the work** — they are not the same
pressure. The compressor discharges into a reticulation column that loses
pressure to friction over a long run before it reaches the leak, so real
discharge pressure is higher than the pressure at the hole and the true
compression work is higher than this model reports. Modelling the distribution
network properly needs pipe runs, diameters and fittings the tool does not have
and a field user cannot supply. The two are separate settings fields, so a site
with a known compressor house pressure can set it correctly. Until then the
figures are conservative in the direction of understating loss, which is the
safer direction for a claim. Add to the known limitations in the README.

**2026-09-07 — The theoretical figure is kept and displayed even when site data
exists** — the obvious move is to hide it once the better number arrives. The
gap between the two is information: a site specific power far above the
theoretical figure points at part-load operation, a worn machine or distribution
losses, and a reviewer with compressor experience reads that gap immediately.
`preferred` marks which one leads; neither is deleted.

**2026-09-07 — `compressor.ts` works in scalars, not bands** — it exports
`PointPowerEstimate`, the single-operating-point form of the banded
`CompressorPowerEstimate` in `types.ts`. `index.ts` runs the low, expected and
high mass flows through and assembles the band. Keeping the uncertainty
machinery out of the physics means the compression equations read as compression
equations, and the band propagation lives in one place (`uncertainty.ts`) rather
than being reimplemented in each module.

**2026-09-07 — The band propagates by mapping endpoints through the same
functions as the expected value, not by a separate error-propagation formula** —
every step from diameter to rand per year is monotonically increasing, and a
monotonic function maps an interval to an interval by its endpoints. So the low
and high cases run through the identical orifice, compressor and cost code that
the expected case runs through. The alternative, propagating a fractional
uncertainty analytically, would mean a second implementation of the physics that
could drift from the first. Costs: three times the arithmetic, which is free at
this scale. `mapRange` checks the monotonicity assumption on every call rather
than trusting it.

**2026-09-07 — The squared band is not re-centred** — plus or minus 30 percent
on diameter becomes minus 51 to plus 69 percent on flow, so the expected value
sits below the midpoint of the band. It would look tidier to report a symmetric
band around the expected figure, and it would be wrong: the high side of a
squared band really is further out. A test asserts the midpoint is *not* the
expected value, so nobody can quietly symmetrise it later to make the register
look neater.

**2026-09-07 — Floating point is left alone inside the calculation** — `3 * 0.7`
is 2.0999999999999996 and stays that way. Rounding inside a calculation to make
a test read nicely is how a rounding error becomes a physics error; the tests
assert to a tolerance instead. Rounding is a display concern and belongs in the
register in Phase 5, where the figures are shown to two or three significant
figures anyway because the input does not support more.

**2026-09-07 — The tariff is entered as its six-bucket structure rather than as
a blended rate** — for a leak pressurised all 8760 hours, the time-of-use sum
and a correctly energy-weighted blended rate give the identical answer, so the
structure buys no arithmetic. It buys auditability. Six numbers can be checked
against an actual electricity account; a blended rate someone worked out once
cannot, and nobody can tell later whether it was worked out correctly. The
seasonal and period split is also what a mine's energy manager already thinks
in, so the settings screen asks for numbers they have rather than numbers they
would have to derive. Costs: six fields on the settings screen instead of one.

**2026-09-07 — A leak pressurised for less than the full year is spread across
the tariff periods pro rata** — and this understates such a leak. A section
that is only live during production shifts sits in peak far more than pro rata
implies. Doing better would mean asking which hours the leak is live, which is
not a question anyone can answer standing in a drive with gloves on, and a
wrong answer to it would be worse than a stated assumption. A test asserts the
effective rate does not move with operating hours, which is the fingerprint of
pro rata, so the assumption is visible in the suite rather than buried. The
default case — mines run continuously — invokes no scaling at all. Add to the
known limitations in the README.

**2026-09-07 — `HOURS_PER_YEAR` is a separate constant from
`DEFAULT_OPERATING_HOURS_PER_YEAR`** — they share the value 8760 today because
mines run continuously, which is exactly why they need separating. One is a
calendar fact and the ceiling on any hours input; the other is a setting a user
may reduce for a section isolated between shifts. Collapsing them would mean
that lowering the operating hours in settings would also silently loosen the
validation that catches a double-counted tariff schedule.

**2026-09-07 — `evaluateLeak` reports a non-choked line rather than letting
`NotChokedError` escape** — `orifice.ts` still throws, and its test still pins
the wording, because a code reader meeting that boundary should meet a clear
statement of it. But the register in Phase 5 calls `evaluateLeak` once per
stored record, and one bad line pressure in settings should not blank the whole
screen. So `evaluateLeak` checks `isChoked` first and returns null bands with
`flowUnavailableReason: 'not-choked'`, keeping the pressure ratio visible so the
reason is legible. `LeakResult` already carried a `choked` field, which is the
type anticipating exactly this case.

**2026-09-07 — Two separate "why is this null" fields on `LeakResult`** —
`flowUnavailableReason` and `costUnavailableReason` are independent. A leak can
have a perfectly good flow figure and no cost because no tariff is entered, or
a valid tariff and no flow because nobody has given the bore of an open line.
Collapsing them into one field would force the UI to guess which question to
ask. `unresolvedInputs` is separate again and names the field the UI should
prompt for, which is what the settings and capture screens need.

**2026-09-07 — An override changes the nominal diameter, not the band width** —
the tempting move is to collapse the band when the user types a measured
diameter. A diameter inferred from an ultrasonic dB reading is not an exact
number, and treating it as one would report false precision at exactly the
moment the user feels most confident. Setting `diameterUncertaintyFraction` to 0
in settings remains available for a hole that was genuinely gauged.

**2026-09-07 — Cost is computed from the preferred power method, not both** —
reporting two cost bands, one per method, would double every row of the
register and force the reader to pick. The two power figures stay visible side
by side with their bases; the money follows whichever is marked preferred, which
is the site figure whenever one exists.

**2026-09-08 — `level-24.svg` is committed alongside `level-24.png`, and the
PNG is rasterized with `npx sharp-cli` rather than a new dependency** — Vercel
only runs `vite build`, so nothing on the deploy regenerates a PNG from an SVG
source; if only the `.svg` were committed, the `imageOverlay` would 404 in
production. `sharp-cli` is invoked once via `npx` to produce the PNG and is
not added to `package.json` — it never runs again after the file exists, so it
is a one-time authoring step, not a build-time or runtime dependency, and does
not count against the approved stack in `CLAUDE.md`.

**2026-09-08 — The Leaflet→image coordinate flip is one pure function,
`leafletPointToImageXY`, not inlined in `MapScreen`** — `CRS.Simple` keeps
Leaflet's convention of lat increasing upward from the bounds' southwest
corner, but a level plan is read with y increasing downward from the top-left.
Getting this backwards silently produces a mirrored plan that still "looks"
plausible on screen, which is exactly the kind of bug that survives a casual
look and only shows up against a real coordinate. Isolating it as a tested
pure function (`src/map/coordinates.ts`) makes the flip an explicit, checked
claim instead of an arithmetic aside inside a component.

**2026-09-08 — Marker is a `CircleMarker`, not the default Leaflet `Marker`
icon** — the default marker icon's image assets don't resolve correctly
through Vite's bundler without extra configuration, and a broken icon (a grey
box) is a bad first impression on the one screen a reviewer sees first. A
`CircleMarker` needs no external image, is trivially styled for dark-background
contrast (amber fill, dark stroke), and Phase 3 replaces it with the real leak
marker anyway.

**2026-09-08 — `MapContainer` uses `bounds` (fit-to-bounds) instead of a fixed
center/zoom, with `minZoom={-2}` and `maxBounds` pinned to the image** — a
hardcoded zoom is only correct for one viewport size; on a 2000×1200 image a
zoom of 0 overflows almost any phone screen and looks like a failed load. Fit-
to-bounds computes the right initial zoom for whatever viewport opens the app.
`maxBounds` (with `maxBoundsViscosity={1}`) stops the user panning into empty
space beyond the plan, and `minZoom={-2}` caps how far out they can go past
that. `doubleClickZoom` is also disabled — two quick taps to reposition a
marker (the intended Phase 2/3 interaction) must not be read as a zoom
gesture.

**2026-09-08 — `level-24.svg` gets an explicit border frame and corner ticks**
— found in manual corner testing: the SVG background (`#0b0f14`) and the page
background around the map are close enough in value that the plan's extent
was invisible — there was no way to tell where the image ended and empty
space began. Underground, with a cap lamp and a phone screen, that ambiguity
means the user can't tell if they're tapping on the plan or past it. Fixed
with a light-linework border rect plus corner ticks, in the same style as the
drive walls, then re-rasterized.

**2026-09-08 — `loggedBy` is a per-device tag, not a person** — there is no
login (out of scope, per `CLAUDE.md`), and nothing in the app can know who is
holding the phone. `LeakRecord.loggedBy` is populated from a UUID generated
once with `crypto.randomUUID()` and cached in `localStorage`
(`src/data/deviceId.ts`) — the same client-owned-identity principle as the
record ids themselves, applied to the "who" field rather than the "which
record" field. This identifies a device, not a crew member. Mapping devices
to crews (a phone assigned to a named person or shift) is a real-deployment
requirement this tool does not attempt — add to the README's "what real mine
data would be needed to trust the output" section.

**2026-09-08 — Open-line diameter is a required inline field, not a collapsed
override, breaking strict three-tap for those two catalogue entries only** —
`LeakRecord.equivalentDiameterMm` is a non-nullable `number` (spec section 7),
but the two open-line types carry `equivalentDiameterMm: null` in the
catalogue by deliberate design (see the 2026-09-07 entry above: "the diameter
is the bore of whatever branch was opened, which only the person on site
knows"). Making the bore field optional-and-collapsed for these two types
would force a choice between inventing a nominal bore or writing an invalid
record; both are worse than asking. So for a leak type with a catalogue
default, three taps still save a record: position, type, save. For the two
open-line types, a fourth, required, un-collapsed step appears — "Bore /
nominal pipe size (mm)" — because it is read off the pipe on sight, not an
inferred equivalent diameter, hence the different label. `buildLeakRecord`
(`src/data/buildLeakRecord.ts`) is the backstop: it throws rather than
building a record with a fabricated diameter, independent of whatever the UI
enforces.

**2026-09-08 — `buildLeakRecord` is a pure function, unit tested, separate
from the Dexie write and the React state around it** — it is the one place a
capture-flow selection turns into stored data, and it is where the category →
`isDeliberateOpenLine` mapping and the "never invent a diameter" rule are
enforced. Everything else in Phase 3 (`db.ts`, `LeakTypePicker.tsx`,
`CaptureScreen.tsx`) is verified manually via `npm run dev` and DevTools →
Application → IndexedDB, the same way `MapScreen.tsx` was verified in Phase
2 — automating that would mean adding `fake-indexeddb` and a DOM-testing
library, neither in the approved stack (`CLAUDE.md`), for coverage this
function's tests already give the part that actually encodes a domain rule.

**2026-09-08 — Out-of-bounds taps are rejected, not clamped** — also found in
manual corner testing: `maxBounds` on the Leaflet map stops the user panning
away from the image, but a click event still fires (and still resolves to a
coordinate) when it lands in the letterboxed margin around the image at
non-fitting zoom levels, producing values like `x: 2190` on a 2000px-wide
plan. The tempting fix is to clamp the coordinate to the nearest edge, but a
clamped tap would silently record a leak position the user never actually
pointed at — worse than no tap registering at all. `isWithinPlan(x, y, width,
height)` (`src/map/coordinates.ts`) is a pure, unit-tested bounds check
(inclusive of the edges) that the click handler calls before updating state;
an out-of-bounds tap leaves the marker and readout exactly as they were.

**2026-09-08 — Service worker `registerType: 'prompt'`, not `'autoUpdate'`,
with a manual reload control** — an autoupdating worker can swap the running
app out from under the user on a signal flicker mid-shift, which is exactly
the kind of surprise this project's field constraints exist to prevent.
`src/sync/UpdatePrompt.tsx` uses `virtual:pwa-register/react`'s
`useRegisterSW` hook and only ever shows a "Reload" control once a new
version is actually waiting — nothing reloads without a tap. Same principle
as the sync queue's manual Retry: no background action the user didn't ask
for.

**2026-09-08 — `syncQueue.ts`'s network attempt is a pure function; only the
retry orchestration touches Dexie** — `attemptSync(record, endpoint)` takes
its endpoint as a parameter (defaulting to the `SYNC_ENDPOINT` constant) and
returns a status rather than writing anywhere, so it can be unit tested by
mocking `fetch` alone — no `fake-indexeddb`, which DECISIONS.md already
ruled out for `buildLeakRecord` on 2026-09-08 as outside the approved stack.
`retryQueue()` is the one function that reads/writes `db.leakRecords`, and it
is called only from the badge's Retry button, never from a timer.

**2026-09-08 — PWA icons generated with a hand-written PNG encoder using
Node's built-in `zlib`, not a new dependency** — the stack has no image
library, and a one-time asset-export step didn't seem worth adding `sharp`
or `canvas` for. Triggering downloads from a live page in the browser
tooling was tried first and abandoned: Chrome silently blocks a second
script-initiated download from the same page without a fresh user gesture
per file, which made it unreliable for generating four files in a row. The
generator script (not committed — one-time use) rasterizes
`public/icons/icon-source.svg`'s design directly: a filled circle in
`LEAK_ACCENT_COLOR` on the app's `#0b0f14` background, the same shape and
colour `MapScreen`'s `CircleMarker` already uses for a leak — so the icon is
what a leak looks like on the plan, not a new mark invented for the app
shell.

**2026-09-08 — Real-device testing (Android, landscape) found two Phase 2
regressions that Chrome device emulation had not caught, both fixed the same
day** — Leaflet's default zoom control renders at roughly 30px, under the
48px field constraint, and defaults to the top-left corner, the same corner
the x/y readout chip already used; the two stacked and covered each other.
`src/map/ZoomControl.tsx` replaces it: 48px buttons, bottom-right, the one
corner none of the app's other overlays (readout chip top-left; sync/update
badges top-right) occupy. Separately, the initial fit had large dead margins
and illegible pipe-section labels — caused by Leaflet's default `zoomSnap`
of 1, which rounds the `fitBounds` zoom down to the nearest whole level and
can leave up to a full zoom level of unnecessary margin. Setting `zoomSnap`
to `0` on `MapContainer` (`src/map/MapScreen.tsx`) lets the fit land on the
exact zoom the viewport allows. Confirmed with a throwaway local viewport
harness (not committed) that renders the built app inside an iframe at an
exact pixel size, since neither the browser tooling used this session nor
`Chrome > Responsive` reliably reproduce a real device's CSS viewport: at
915×412 (phone landscape) the plan now fills the full viewport height with
zero margin beyond what its own 5:3 aspect ratio forces against a ~2.2:1
screen (114px each side — the mathematical minimum for that combination,
not a defect).

**2026-09-08 — Portrait is functional but shows large empty margins above
and below the plan, and that is not something further fitting code can
fix** — checked at 412×915. The level plan is drawn landscape (2000×1200);
a portrait phone screen is much taller and narrower than that shape, so a
tight fit is necessarily width-bound, leaving most of the screen empty top
and bottom. Controls don't overlap and the plan itself is fully legible at
that size, so the screen is usable — but a real user logging leaks is
better served holding the phone in landscape, matching the plan's own
orientation. Not treated as a bug to fix in code; if it matters later, the
lever is redrawing the plan image closer to a phone's native aspect ratio,
not the map-fitting logic.

**2026-09-08 — Test records cleared from the field-test device by hand;
"clear all records" logged as a Day 6 settings item, not built now** — 21
records from real-device Phase 4 testing were removed via the device's
browser site-storage settings (Claude has no access to a physical Android
device to do this remotely). The same reset will be needed repeatedly
between now and ship for demo purposes, so a destructive, confirm-first
"clear all records" control belongs on the Phase 6 settings screen —
recorded in TODO.md rather than built out of phase.

**2026-09-08 — Portrait horizontal clipping fixed properly, not by going
landscape-only, and it took two tries** — real-device testing found the
plan overflowing horizontally in portrait, clipping both edges (SP-14 and
the DRIVE A label on the left, the legend on the right), so PS-01/PS-08
needed panning to reach. Root cause: the `minZoom={-2}` added earlier the
same day for the zoomSnap fix was tighter than the zoom a narrow portrait
viewport needs to fit a landscape-shaped plan by width — `fitBounds`
clamped to -2, which is more zoomed in than the fit calls for, so the image
overflowed both edges instead of letterboxing top and bottom. (The iframe
viewport harness had reported portrait as "fine" — it measured the iframe's
own edges, not the image's content against them, so a clipped
edge-to-edge image looked identical to a correctly-fit one in that check.
Noted so the same blind spot doesn't recur: verify against the source
image's actual content, not just against the container edges.)

The fix went through two wrong turns before landing:

1. First attempt: read `map.getZoom()` in a mounted child component and call
   `map.setMinZoom()` with it, to make the floor track whatever zoom the
   fit actually used instead of a constant. This raced MapContainer's own
   `bounds`-triggered fit — whichever ran first — and losing that race
   meant capturing the pre-fit default zoom (0) and locking minZoom there,
   which clamped the real fit to full native resolution, mostly off-screen.
2. Second attempt: replaced `getZoom()` with `getBoundsZoom(bounds)`,
   assuming it computed the ideal fit zoom independent of the map's current
   state. It doesn't: Leaflet's `getBoundsZoom` (and `fitBounds`) both clamp
   their own result to the map's *current* `minZoom` — and with the fixed
   `minZoom={-2}` removed and nothing set yet, Leaflet's default (0) clamped
   every computed fit to zero before the new component could act on it.

The working fix (`src/map/MapScreen.tsx`) sets a generous static
`minZoom={-10}` directly on `MapContainer` — low enough that it never binds
for this image on any realistic viewport, so it doesn't interfere with
Leaflet's own internal clamping — and a `FitZoomFloor` child component then
tightens `minZoom` to the real per-viewport value via `getBoundsZoom` once
mounted, so the user still can't zoom out past "whole plan visible."
Reconfirmed with the same viewport harness at exact 915×412 and 412×915:
landscape unchanged, portrait now fits full-width with no clipping.

**2026-09-08 — An open line is costed through the same choked-orifice
physics as a leak, but never through `evaluateLeak` itself; the diameter
is a point value and the discharge coefficient is banded instead** — a
choked orifice is a choked orifice regardless of why the opening exists, so
`evaluateOpenLine` (`src/calc/openLine.ts`) reuses `chokedMassFlowKgPerS`
and `computePowerAndCost` unconditionally; there is no separate physics for
a deliberate open line. What it does not reuse is `evaluateLeak`'s
diameter-uncertainty step, and that is the actual guard, not the orifice
equation. `evaluateLeak`'s diameter band exists because its input is an
inferred fiction — a person underground picking the closest catalogue
description of a sound or a plume, with no instrument on it — so the
diameter itself is the uncertain quantity and gets banded ±30%
(`diameterUncertaintyFraction`). An open line's bore is read directly off
the pipe; running it through that same inference model would band a
measured number as if it, too, were a guess, which manufactures uncertainty
that isn't there and hides the uncertainty that is: how cleanly an ad hoc
opening — a cut pipe end, a missing flange, a valve half off its seat —
actually discharges, versus a manufactured nozzle a discharge coefficient
was calibrated against. So `evaluateOpenLine` holds the bore as a point
value (`boreMm`, `low === expected === high`) and bands the discharge
coefficient instead, via `coefficientBand` and its own settings fraction,
`openLineDischargeCoefficientUncertaintyFraction` — deliberately a
separate field from `diameterUncertaintyFraction`, not a reuse of it, so
that changing one never silently moves the other. Net effect: same
equation, same shared cost tail, different quantity treated as the unknown.

**2026-09-08 — `src/calc/index.ts` split into leaf modules to keep the
module graph acyclic once `summarise.ts` needed to call both evaluators**
— `evaluateLeak`, `evaluateOpenLine` and `summariseLeaks` used to be
candidates for living directly in `index.ts` (`evaluateLeak` did, before
today; `evaluateOpenLine` and `summariseLeaks` were deferred there — see the
2026-09-07 entry above marking `summariseLeaks` as "belongs in `src/calc`,
not in a component, deferred to Phase 5"). That stopped working the moment
`summariseLeaks` existed: it has to call both `evaluateLeak` and
`evaluateOpenLine` to dispatch a record by the catalogue's own category
(spec's separate-category rule made concrete, not a display choice), and
`index.ts` re-exports `summariseLeaks` as the module's public surface. If
either evaluator were defined inside `index.ts`, `summarise.ts` would import
from `index.ts` to reach it, while `index.ts` imports from `summarise.ts` to
re-export `summariseLeaks` — a cycle. The fix is the ordinary one: nothing
in `src/calc` other than `index.ts` may import `index.ts`, so every function
`index.ts` exports now lives in its own leaf module and is re-exported, never
defined, there. `evaluateLeak.ts` and `openLine.ts` hold the two evaluators;
`catalogue.ts` holds `findLeakType`, needed by both without either importing
the other; `powerAndCost.ts` holds the mass-flow-to-cost tail the two
evaluators share once a flow band exists (identical physics regardless of
whether the flow came from a leak's banded diameter or an open line's banded
discharge coefficient); `summarise.ts` holds the dispatch and totalling.
`index.ts` itself dropped from 286 lines to 51 and holds no logic — every
line in it is either a constant/type re-export or a bare `export { x } from
'./leaf.ts'`. This entry is what `index.ts`'s own module doc comment points
at ("see DECISIONS.md, Phase 5, for why that matters") — that reference was
written before this entry existed, during the session the machine restart
interrupted; it is resolved now, not a new decision.

**2026-09-08 — A leak's diameter-band basis follows the provenance of the
input, the same principle already applied to open lines** — the 2026-09-08
entry above on open-line costing established that what a band is honestly
labelled as depends on where the number came from, not just on which
category the record is. That principle turned out to apply inside the leak
path too, not only between leaks and open lines: `evaluateLeak` runs the
identical ±30% band (`diameterUncertaintyFraction`) whether
`equivalentDiameterMm` is a measured override (a caliper or ultrasonic
figure) or the catalogue's inferred default, because "it sounded like a
coupling" and "I measured 4.5 mm" are different claims about where the
number came from even when the tool treats them with the same width of
uncertainty. The CSV's "Band basis" column had been writing
`equivalent-diameter ±30%` for every leak row regardless, which is a false
statement about provenance for a measured row. `LeakResult` now carries
`diameterProvenance: 'measured' | 'catalogue' | null` (`types.ts`), set by
`evaluateLeak` from whether `LeakInput.equivalentDiameterMm` was supplied —
the same `??` presence check the nominal value itself already used, so there
is no second rule to keep in sync with the first. Null is reserved for when
there is no band to explain at all (an open line, whose band comes from the
discharge coefficient instead — see the earlier entry — or a leak whose
diameter is still unresolved). The band **width** does not change with
provenance: a measurement carries its own real error, and narrowing the
band for it without an actual measurement-error figure to justify a
narrower number would be fabricating precision, the same failure mode as a
guessed tariff. Only the label changes: "catalogue equivalent diameter
±30%" versus "measured diameter, ±30% assumed", both shown in the CSV
column and as the register's diameter-cell tooltip (`bandBasis` in
`csv.ts`, exported so the two cannot drift apart on wording).

Getting this right end to end needed one more piece, past what looked at
first like a calc-layer-only change: `evaluateLeak` can only infer
provenance correctly when an absent override actually reaches it as
`undefined`, and the stored `LeakRecord` did not carry enough information
to produce that. `buildLeakRecord.ts` had always collapsed
`diameterOverrideMm ?? leakType.equivalentDiameterMm` into one resolved
number, with no memory of which side of the `??` supplied it — so
`summarise.ts`, reading a `LeakRecord` back out, could not tell "the user
typed 3mm, which is also the catalogue default" from "no override was
given, so this is the catalogue default." A same-value comparison against
the catalogue default was considered and rejected: it would mislabel
exactly that case, a measured figure that happens to coincide with the
catalogue number, as inferred — silently discarding a real measurement's
provenance. So `LeakRecord` gained its own `diameterProvenance: 'measured' |
'catalogue'` field (`src/data/db.ts`), computed once in `buildLeakRecord.ts`
at the moment the override is either given or not — the only point this
fact is actually known — using the identical presence check `evaluateLeak`
uses, so the two cannot disagree about what "measured" means. No Dexie
version bump: the field is not indexed, so existing stored objects simply
read back without it, and `RegisterScreen.tsx` falls back to `'catalogue'`
for that case (unknown defaults to the unremarkable label, never the more
specific claim). `summarise.ts`'s `evaluateRecord` then only forwards
`record.equivalentDiameterMm` to `evaluateLeak` as an override when
`record.diameterProvenance === 'measured'`; when it is `'catalogue'` the
field is omitted so `evaluateLeak` falls back to the leak type's own
default and infers `'catalogue'` correctly on its own, rather than being
told twice. A deliberate open line's bore is always `'measured'` — spec
section 4's two open-line catalogue entries have no diameter default, so
the capture flow's required, non-collapsed bore step (2026-09-08, "Open-line
diameter is a required inline field") always supplies one.

**Known limitation, for the README** (`compressed-air-leak-survey-tool-spec.md`
section 11 / `PLAN.md` Phase 7's "known limitations" section — no README
exists yet, this is written here so it can be lifted directly when Phase 7
starts): a measured diameter still carries the catalogue's ±30% band, because
the tool has no measurement-error figure of its own to band it by instead.
The wording distinguishes where the number came from ("measured" versus
"catalogue"), but not yet how much more confidence a measurement deserves
— today it gets none. A real deployment carrying ultrasonic-detector data
with a known instrument error should narrow `diameterUncertaintyFraction`
for measured readings specifically, which the settings screen does not yet
support (it has one fraction, applied uniformly); that is future work, not
something this phase invents a number for now.