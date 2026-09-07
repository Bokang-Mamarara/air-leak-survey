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