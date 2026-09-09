# Compressed Air Leak Survey

An offline-first tool for logging compressed air leaks underground on a
deep-level mine and costing them in rand per year. Built in seven days as a
portfolio artefact. It runs in a phone browser, installs to the home screen,
and works with no signal.

Live: https://air-leak-survey1.vercel.app/

---

## 1. The problem

Compressed air accounts for roughly 20% of the total electrical energy
consumption of a deep-level mine [1]. Leakage accounts for as much as 35% of
the energy losses of a compressed air network ([1], citing [2]). On top of
leakage proper, compressed air is routinely misappropriated for unregulated
underground self-ventilation — crews opening pipelines to get airflow where
ventilation is short.

Refuge bays are a specific case of this. A refuge bay is a chamber held at
positive pressure so that it provides a safe environment during a noxious gas
leak [1], and compressed air is what holds it there. Crews open lines in and
around them for airflow, and the resulting consumption is large enough to be
worth an intervention on its own: reducing refuge bay air usage on the case
study mine in [1] gave an average power reduction of 0.9 MW — about 22 MWh a
day — worth roughly R6.3 million a year.

Against numbers of that size, some mines still find leaks by the
walk-and-listen method ([1], citing [3]): a person underground, no signal,
wearing gloves, writing findings on paper and typing them up later if they
remember.

**This tool does not automate detection.** Automating detection means
continuous acoustic sensors wired underground, which is a different and much
larger project. Detection stays walk-and-listen, or an ultrasonic detector
where the crew carries one. What this replaces is the step immediately after
detection — the "typed up later, if someone remembers" step. The leak is logged
on the spot, on the level plan, with a rand-per-year band attached to it before
the person has walked ten metres further.

Because the person in the drive has no flow meter, the input is not a
measurement. They pick the closest description of what they heard or saw from a
leak-type catalogue, and the tool infers an equivalent orifice diameter from
that. Everything downstream of that inference is arithmetic; the inference
itself is the dominant uncertainty in the whole calculation, and section 5 is
about not hiding that.

---

## 2. Leak mass flow — the choked orifice

Mine reticulation runs at 400–500 kPa gauge. A leak vents to atmosphere, so at
500 kPa(g) the pressure ratio across the opening is

    P₂/P₁ = 101 325 / 601 325 = 0.169

The critical pressure ratio for air is

    P*/P₁ = (2/(k+1))^(k/(k−1)) = (2/2.4)^3.5 = 0.528

0.169 is well below 0.528, so the throat is sonic. The flow is **choked**: the
mass flow is fixed by upstream conditions alone and nothing downstream of the
hole can influence it. The margin is wide — the line would have to fall below
about 91 kPa gauge before this stopped holding.

For choked isentropic flow through an orifice of area *A*:

    ṁ = Cd · A · P₁ · √(k / (R·T₁)) · (2/(k+1))^((k+1)/(2(k−1)))

The two constant groups collapse into one. With k = 1.4 and R = 287 J/kg·K:

    √(k/R)                      = √(1.4/287) = √0.00487805 = 0.0698430
    (2/(k+1))^((k+1)/(2(k−1)))  = 0.833333^3.0             = 0.5787037

    √(k/R) · (2/(k+1))^(…)      = 0.0698430 × 0.5787037    = 0.040418

which is where the familiar figure comes from:

    ṁ = 0.0404 · Cd · A · P₁ / √T₁        [kg/s, m², Pa absolute, K]

0.0404 is not a given, and it is not universal — it is
√(k/R)·(2/(k+1))^((k+1)/(2(k−1))) evaluated for air. `constants.test.ts`
recomputes it from k and R and asserts agreement with the quoted value, so the
rounding is a checked claim rather than a copied number.

Discharge coefficients: 0.61 for a sharp-edged hole, 0.8 for a rounded or
nozzle-like opening, 1.0 for a fully open bore. All three are settings inputs,
applied per catalogue entry.

**On the downstream pressure argument.** `chokedMassFlowKgPerS` takes a
downstream pressure it never uses in the equation. That looks redundant and is
the point: once the flow is choked, downstream pressure *cannot* appear in the
mass flow term, so the function requires it in order to prove the assumption
holds before relying on it. A test asserts that two different downstream
pressures, both sub-critical, return byte-identical mass flows while reporting
different pressure ratios — the defining property of choked flow, written as an
executable claim rather than a comment.

If the ratio is above critical, the function throws rather than computing a
subsonic answer. Implementing the subsonic branch would add code that can never
run on a real reticulation line; the error message states the boundary of the
model instead. `evaluateLeak` catches the condition and returns null bands with
a reason, so one bad pressure in settings cannot blank the whole register.

---

## 3. Compressor power — two methods, side by side

A leak costs money at the compressor, not at the hole. Two methods convert mass
flow into shaft power, and both are reported.

**Theoretical — multi-stage polytropic with intercooling.** Per stage:

    W = ṁ · (n/(n−1)) · R · T₁ · [ (P₂/P₁)^((n−1)/n) − 1 ] / η

The total pressure ratio is split equally across the stages and the air returns
to inlet temperature between them, which is what the intercoolers are for.
n = 1.35 for a cooled compression path, between isothermal (1.0) and isentropic
for air (1.4). η = 0.75 is an assumption, not a measurement.

This method exists precisely for the case where no site data is available: it
needs nothing but the line pressure and three stated assumptions. Every one of
those assumptions — n, η, stage count — is a settings field rather than a
source constant, and every estimate carries a `basis` string ("theoretical
polytropic, n = 1.35, eta = 0.75 assumed, 2 stages intercooled…") displayed
next to the figure on screen. The first thing anyone with compressor experience
does is push η to 0.70 and watch what moves; that has to be a settings edit,
not a source edit.

**Empirical — the mine's own specific power**, in kW per m³/s of free air
delivered, off its own compressor performance data. Mass flow is converted to
free air at reference intake conditions (101.325 kPa, 20 °C, ρ = 1.204 kg/m³),
because that is the basis specific power is quoted against and what makes one
machine's figure comparable with another's.

**Where a site figure exists it wins.** `preferred` marks it, and the cost
calculation follows the preferred method. Where no site figure exists,
`specificPowerKwPerM3PerSec` is `null` — not a plausible default — and the
theoretical method carries the estimate on stated assumptions.

**Why they are shown together and never averaged.** They answer different
questions. The theoretical figure is idealised shaft work: it excludes motor
and drive losses, the part-load efficiency penalty a machine carries away from
its best point, and the reticulation pressure drop between the compressor house
and the leak. Read it as a **floor**, not a prediction. The hand-checked 3 mm
coupling implies 271 kW per m³/s by the theoretical route; a real machine's
site figure will be higher.

The gap between the two is information. A site specific power far above the
theoretical floor points at part-load operation, a worn machine, or
distribution losses — and an energy engineer reads that gap immediately.
Averaging the two would destroy exactly that signal and produce a number that
is neither an idealised floor nor a measurement. `CompressorPowerBreakdown` has
two named fields and deliberately nowhere to put a third.

---

## 4. Summed leak power is not realised saving

This is the section to read before believing any number this tool produces.

The register will show a total: so many kilowatts, so many rand per year,
across every leak logged on the level. That total is **potential loss**. It is
not a saving, and it is not a forecast of a saving. It is the compressor power
currently being consumed to make up air that is going nowhere useful.

Whether any of it is recovered depends entirely on what the compressor does
when the leak is closed.

**If the compressor responds**, the saving is real. Responding means unloading,
reducing guide vane or inlet valve position, reducing speed on a VSD machine,
or — the largest response available — a machine being switched off entirely
because the remaining demand fits on fewer units. The recovered air becomes
reduced electrical draw at the compressor house, and the figure in the register
is approximately what appears on the account.

**If the compressor does not respond, almost nothing is saved.** A fixed-speed
machine running against a network whose demand has just dropped does not draw
proportionally less power. The air that was leaking now has nowhere to go, so
system pressure rises. Power draw against higher discharge pressure barely
moves, and in the blow-off case it does not move at all — the air is simply
vented at the compressor instead of underground. The leak has been repaired and
the electricity bill is unchanged.

**Worse, the rise in system pressure increases flow through every leak still
open.** Choked mass flow is directly proportional to absolute upstream
pressure, so a network that drifts from 500 to 550 kPa gauge after a repair
campaign puts about 8% more air through every remaining hole. Fixing leaks
without a compressor control response can therefore leave the network losing a
substantial fraction of what was "saved" through the leaks that were not fixed.
The energy did not go away; it moved.

This has three consequences for how the output should be used.

1. **The totals are not additive with respect to realised saving.** Repairing
   ten leaks does not save the sum of their ten individual figures. Each repair
   changes the operating point that the next one is evaluated against.
2. **The ranking is more trustworthy than the total.** Which leak is worth
   attending to first is a comparison between rows under identical assumptions,
   and it survives everything above. The absolute rand figure at the bottom of
   the column does not, on its own.
3. **A leak survey is one half of a compressed air intervention.** The other
   half is compressor control — set-point management, sequencing, unloading
   strategy, and the decision to switch a machine off. Without it, this tool
   measures a problem that the site is not yet in a position to convert into
   money.

The caveat lives as a single exported constant, `REALISED_SAVING_CAVEAT` in
`src/calc/constants.ts`, imported by the surface screen and quoted here, so the
on-screen wording and the README cannot drift apart. It renders in the register
above the fold, not in a tooltip. It is a property of the method, not of any
individual leak, which is why it is not a field on every stored record.

---

## 5. Uncertainty — why every figure is a band

Every energy and cost output is a `{ low, expected, high }` band. A single
figure to two decimal places would be a false statement about the input data,
and it would be read as a true one.

### Where the band comes from — a leak

Not from the equations. The choked orifice relation is well established and the
arithmetic is exact. The uncertainty is in the very first input: a person
underground picking the closest catalogue description of a sound or a plume,
with no instrument on it. That inference carries roughly ±30%, applied
uniformly through `diameterUncertaintyFraction`.

Uniformly, and not per leak type, on purpose. A pinhole is arguably
proportionally more uncertain than a 12 mm open branch, but there is no data to
set six different bands from, and six invented figures dressed as precision are
worse than one documented judgement figure that is honest about what it is.
`LeakTypeDefinition` has room for a per-type override when real measurement
data justifies one.

### The d² propagation

Mass flow goes with area, and area goes with the square of diameter. A
symmetric band on diameter does not stay symmetric:

    d_low  = 0.70 × d    →  (0.70)² = 0.49  →  −51% on flow
    d_high = 1.30 × d    →  (1.30)² = 1.69  →  +69% on flow

Every step after the orifice — free air delivery, compressor power, annual
energy, annual cost — is directly proportional to mass flow. None of them
widens the band and none of them narrows it. So −51%/+69% is established at the
orifice and carried unchanged all the way to rand per year. For the
hand-checked 3 mm coupling: 0.67 to 2.32 kW, best estimate 1.37 kW.

**The band is not re-centred.** The midpoint of that power band is 1.50 kW, 9%
above the expected value of 1.37 kW. Reporting "1.50 ± 0.82 kW" would be tidier
and would be wrong: the high side of a squared band genuinely is further out. A
test asserts that the midpoint is *not* the expected value, so nobody can
quietly symmetrise it later to make the register look neater.

### How the band is propagated

By mapping the endpoints through the same functions as the expected value, not
by a separate error-propagation formula. Every step from diameter to rand per
year is monotonically increasing, and a monotonic function maps an interval to
an interval by its endpoints — so the low and high cases run through the
identical orifice, compressor and cost code the expected case runs through. The
alternative, propagating a fractional uncertainty analytically, would be a
second implementation of the physics that could drift from the first. It costs
three times the arithmetic, which is free at this scale. `mapRange` checks the
monotonicity assumption on every call rather than trusting it.

### Where the band comes from — an open line

Different quantity. An open line's bore is read directly off the pipe — a 25 mm
branch is a 25 mm branch — so it is held as a **point value**, not banded.
Running a measured bore through the leak path's inference model would
manufacture uncertainty that is not there while hiding the uncertainty that is.

What is genuinely uncertain for a deliberately opened line is how cleanly the
opening discharges. An unbevelled cut pipe end, a missing flange, a valve half
off its seat — none of these is the calibrated nozzle a discharge coefficient
was measured against. So `evaluateOpenLine` bands the **discharge coefficient**
instead: 0.8 × (1 ± 0.25) spans 0.6 to 1.0, which brackets the sharp-edged
value (0.61) and the fully-open value (1.0). That is the real range of how
ragged or clean an ad hoc opening turns out to be, rather than an invented
figure. It has its own settings field, deliberately separate from the diameter
fraction, so changing one never silently moves the other.

Same equation, same cost tail, different quantity treated as the unknown.

### A measured diameter still carries the catalogue band

If the crew has a caliper or an ultrasonic detector and types in a measured
diameter, the tool records that the number was measured — `diameterProvenance`
is carried on both the stored record and the result, and the CSV and the
register say "measured diameter, ±30% assumed" rather than "catalogue
equivalent diameter ±30%".

But the band **width** does not change. A measurement carries its own real
error, and this tool has no measurement-error figure to band it by instead.
Narrowing the band for a measured reading without a number to justify the
narrower band would be fabricating precision at exactly the moment the user
feels most confident — the same failure mode as inventing a tariff. So the
label changes and the width does not, and that is stated rather than glossed.
Setting `diameterUncertaintyFraction` to 0 remains available in settings for a
hole that was genuinely gauged.

---

## 6. Field constraints, and what each one forced

Every constraint here comes from the field, not from taste. Each one closed off
an implementation option that would otherwise have been the obvious choice.

**No GPS.** There is no satellite signal underground, so `navigator.geolocation`
is not merely unreliable, it is unavailable. Position is a tap on a level plan.
*Forced:* Leaflet with `CRS.Simple` and an `imageOverlay`, image pixel
coordinates end to end, never lat/lng. The Leaflet-to-image y-flip is one
tested pure function (`leafletPointToImageXY`) rather than an arithmetic aside
inside the component — getting it backwards produces a mirrored plan that still
looks plausible on screen, which is the kind of bug that survives a casual
look. A tap landing in the letterboxed margin outside the image is **rejected,
not clamped**: a clamped tap would silently record a position the user never
pointed at.

**Three taps to log a leak.** Position, type, save. *Forced:* the leak-type
catalogue with a default equivalent diameter per entry, so no numeric entry
sits in the primary path; the measured-diameter override and note are collapsed
behind "More detail". The two self-ventilation categories are the deliberate
exception — they have no catalogue diameter, because the bore is whatever
branch was opened and only the person standing in front of it knows. Rather
than invent a nominal bore or write an invalid record, those two types get a
fourth, required, un-collapsed step. `buildLeakRecord` throws rather than
constructing a record with a fabricated diameter, independent of what the UI
enforces.

**Self-ventilation is not a leak.** A refuge bay is held at positive pressure
so that it is survivable during a noxious gas leak [1]; an open cooling line is
airflow a crew could not get any other way. Both are deliberate open valves
compensating for a ventilation shortfall, and the fix is a ventilation
intervention, not a maintenance job. *Forced:* a separate category the whole way
down. `summariseLeaks` returns `leakTotals` and `openLineTotals` as two named
buckets with no combined field; the register renders them as two sections with
two charts; `evaluateOpenLine` is a separate entry point from `evaluateLeak`.
Merging them would produce a maintenance backlog full of items maintenance
cannot fix, and would overstate the leak total with air that is doing a job.

**Gloves — 48px minimum touch targets.** *Forced:* replacing Leaflet's default
zoom control, which renders at about 30px and defaults to the top-left corner
where the coordinate readout already sat. `ZoomControl.tsx` is 48px buttons in
the bottom-right, the one corner no other overlay uses. Found on a real Android
device; Chrome device emulation had not caught it.

**Dark, high contrast — a cap lamp and a phone screen in a dark drive.**
*Forced:* no basemap tiles, a dark plan, an amber `CircleMarker` for leaks. Also
forced a fix that only appears in the field: the plan's dark background and the
page background around it were close enough in value that the extent of the
plan was invisible, so there was no way to tell whether a tap was landing on
the plan or past it. The plan image gained an explicit border frame and corner
ticks.

**Visible sync queue.** Silent queues destroy trust in offline apps. *Forced:* a
pending count always rendered on the map screen, showing "0 pending" rather
than disappearing when empty. It also forced what is *not* there: retry is a
button, never a timer, and the service worker is registered with
`registerType: 'prompt'` rather than `autoUpdate`, so a new version shows a
Reload control instead of swapping the running app out from under someone
mid-shift on a signal flicker. No background action the user did not ask for.

**The map renders first.** Not a login, not a menu, not a dashboard. *Forced:*
`App.tsx` renders `MapScreen` directly — no router, no shell, no splash.
Settings load from IndexedDB asynchronously with `DEFAULT_CALC_SETTINGS`
applying until the stored row arrives, so nothing on the render path waits on
storage, and nothing anywhere waits on the network.

**No backend.** *Forced:* client-owned identity. UUIDs are generated on the
device with `crypto.randomUUID()`, and a record is complete and valid with no
server present. Dexie holds everything; sync is a stub that marks records
pending, synced or failed and fails quietly into the queue. The build is
static, and there is no `api/` directory — Vercel makes a serverless function
trivially easy to add, which is exactly why the absence is deliberate and
stated here.

Cutting the backend is a decision, not a shortcut: it proves the constraint that
mattered was the field, not the server. What it costs is real and is listed in
section 8.

---

## 7. What real mine data would be needed to trust the output

The tool runs on stated assumptions wherever a real, site-specific figure
isn't available. Trusting the output for an actual mine means replacing each of
the following with the real thing:

### Tariff

The tariff is deliberately unset. Compressed air leak costing needs the
site's own Megaflex rates, which are not a single national figure:

- Eskom Schedule of Standard Prices, Table 1 (Megaflex non-local
  authority), effective 1 April 2026 to 31 March 2027
- Rates are seasonally and time-of-use differentiated and depend on the
  voltage of supply and the Transmission zone, so the correct six rates
  are specific to the mine's point of delivery
- High-demand season is 1 June to 31 August; low-demand season is
  1 September to 31 May
- Published rates include VAT at 15%; the schedule also shows excl-VAT
  rates, and which applies depends on the site's VAT treatment
- Megaflex applies above an NMD of 1 MVA, which a deep-level mine exceeds

The tool therefore reports energy in kWh/yr with no cost figure until a
site tariff is entered, rather than defaulting to a national average that
would be wrong for every specific mine.

### Compressor performance

Specific power in kW per m³/s of free air delivered, from the site's own
compressor curves, at the operating discharge pressure and — critically —
across the loading range the machines actually run at, not only at their design
point. Without it the tool falls back to the theoretical floor, which
understates real consumption by an amount nobody can quantify from inside the
tool.

### Actual line pressures

The default is 500 kPa gauge, the top of the typical 400–500 band, chosen
because it is conservative for a leak estimate. Real pressures vary by level
and by time of day. Separately and more importantly, the **compressor discharge
pressure** is a different number from the pressure at the leak — the
reticulation column loses pressure to friction over a long run — and the tool
currently defaults the two to the same figure. A site that knows its compressor
house pressure should set it, at which point the reported loss rises.

### Level plans

The shipped plan is a hand-drawn placeholder at 2000×1200 px with fictional
pipe-section markers. A real deployment needs the mine's own level plans as
images with a known pixel extent, and the pipe sections or survey pegs marked
on them, so that a tapped coordinate can be handed to a fitter as a location
rather than a pixel.

### A mapping from devices to people

`loggedBy` is a per-device UUID cached in `localStorage`, not a person — there
is no login, and nothing in the app can know who is holding the phone.
Identifying a crew member means a register of which device was issued to whom,
which is a deployment matter this tool does not attempt.

---

## 8. Known limitations

Listed because a reviewer will find them anyway, and because a tool whose
limits are stated is more useful than one whose limits are discovered.

**The physics**

- **The orifice model overestimates long or tortuous leak paths.** A blown
  coupling face is approximately a sharp-edged hole and the model suits it. A
  valve gland leak is a long path through packing, and the same model will
  overestimate it, in some cases substantially.
- **Equivalent diameters are inferred from a catalogue, not measured.** This is
  the largest single uncertainty in the tool and is the reason for the ±30%
  band. Ultrasonic measurement is materially better.
- **A measured diameter still carries the catalogue band.** The tool
  distinguishes where the number came from but not yet how much more confidence
  a measurement deserves — it has no instrument-error figure to justify a
  narrower one. A deployment carrying ultrasonic data with a known error should
  narrow `diameterUncertaintyFraction` for measured readings specifically,
  which the settings screen does not currently support: it has one fraction,
  applied uniformly.
- **Choked flow only.** A pressure ratio above the critical value is reported
  as an unavailable result, not computed. The tool cannot cost a low-pressure
  system.

**The compressor and the money**

- **Specific power varies with loading.** A single figure does not capture the
  part-load efficiency penalty, and a mine's compressors spend most of their
  life away from the design point.
- **Compressor discharge pressure defaults to the line pressure at the leak,
  which understates the work.** They are not the same pressure. Modelling the
  distribution network properly needs pipe runs, diameters and fittings that a
  field user cannot supply. The two are separate settings fields for a site
  that knows the real figure; until then the output errs toward understating
  loss, which is the safer direction for a claim.
- **Leak losses are not additive with respect to realised saving.** See
  section 4. This is the limitation that matters most.
- **A leak pressurised for less than the full year is spread across the tariff
  periods pro rata, which understates it.** A section live only during
  production shifts sits in peak far more than pro rata implies. Doing better
  means asking which hours the leak is live, which is not a question anyone can
  answer in a drive with gloves on, and a wrong answer would be worse than a
  stated assumption. The default case — mines run continuously — invokes no
  scaling at all.

**The record and the device**

- **Device clock drift affects timestamps** on a shift with no network to
  correct against.
- **`loggedBy` identifies a device, not a person.** There is no authentication
  and the app cannot know who is holding the phone.
- **No backend means no multi-device register.** Each phone holds its own
  records; the sync endpoint is a stub. Two people surveying the same level
  produce two separate registers.

**The interface**

- **The plan is landscape-shaped, and portrait leaves large empty margins.**
  The plan is fully legible and no controls overlap in portrait, but a
  landscape-shaped image in a portrait frame is width-bound and most of the
  screen above and below it is unavoidably empty. The lever is redrawing the
  plan closer to a phone's aspect ratio, not the map-fitting code. Survey in
  landscape.
- **Settings help text is hand-transcribed from the source comments in
  `constants.ts`** and can drift from them. TypeScript strips comments, so the
  settings screen cannot import that prose. The real fix is exporting those
  strings as values next to the numbers they describe, the way
  `REALISED_SAVING_CAVEAT` already is.

---

## Running it

    npm install && npm run dev        # dev server — note: no service worker
    npm run test                      # 243 tests; npm run typecheck for tsc
    npm run build && npm run preview  # required to test offline behaviour

---

## References

[1] Friedenstein, B.M., Cilliers, C. and van Rensburg, J. 2018. "Simulating
    operational improvements on mine compressed air systems." *South African
    Journal of Industrial Engineering*, 29(3), pp. 69–81.
    DOI: 10.7166/29-3-2049.
    Case study is a deep-level gold mine. Source for the 20% share of total
    electrical energy consumption, the refuge bay definition and the 0.9 MW /
    R6.3 million a year refuge bay result, and — as its own cited sources —
    for [2] and [3] below.

[2] Cilliers, C. 2015. *Benchmarking electricity use of deep-level mines.*
    PhD thesis, North-West University, Potchefstroom.
    Cited in [1] as the source for leakage accounting for as much as 35% of a
    compressed air network's energy losses.

[3] van Tonder, K. 2011. *Sustaining compressed air DSM project savings using
    an air leakage management system.* MEng dissertation, North-West
    University.
    Cited in [1] as the source for the walk-and-listen leak detection method
    alongside ultrasonic detection.
