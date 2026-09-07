# HANDCHECK.md

One leak, worked through on paper, then reconciled against the code.

The point of this document is that the calculation module was not trusted
because its tests pass. Tests written by the same person who wrote the
implementation can agree with each other and both be wrong. So one case was
worked by hand first, and the same case is asserted in `src/calc/index.test.ts`.
If the two ever disagree, one of them is wrong and the disagreement is visible
rather than silent.

Every figure below was computed by hand before the module was run. The
reconciliation table at the end is the comparison.

---

## The case

A failed hose coupling, the most common finding on a walk-and-listen survey.

| Input | Value | Where it comes from |
|---|---|---|
| Equivalent diameter | 3 mm | `failed-hose-coupling` catalogue entry, spec §4 |
| Discharge coefficient | 0.61 | sharp-edged hole, spec §3.1 |
| Line pressure | 500 kPa gauge | `DEFAULT_LINE_PRESSURE_KPA_G`, top of the 400–500 band |
| Air temperature in the line | 20 °C | `DEFAULT_AIR_TEMPERATURE_C` |
| Atmospheric pressure | 101.325 kPa | standard atmosphere |
| Polytropic exponent | 1.35 | cooled compression path, spec §3.2 |
| Isentropic efficiency | 0.75 | **assumption**, not site data |
| Stages | 2 | assumption, equal ratio, intercooled |
| Operating hours | 8760 h/year | mine runs continuously |
| Tariff | **not set** | no real schedule available |

---

## Step 1 — Orifice area

    A = pi d^2 / 4
      = pi x (0.003)^2 / 4
      = pi x 9.0000000e-6 / 4
      = 2.8274334e-5 / 4

    A = 7.0685835e-6 m^2

## Step 2 — Absolute conditions

    P1 = 500 000 + 101 325           = 601 325 Pa
    P2 = 101 325 Pa
    T1 = 20 + 273.15                 = 293.15 K

## Step 3 — Is the flow choked?

Critical pressure ratio for air, k = 1.4:

    (2/(k+1))^(k/(k-1)) = (2/2.4)^3.5
                        = 0.8333333^3.5
                        = exp(3.5 x ln 0.8333333)
                        = exp(3.5 x -0.1823216)
                        = exp(-0.6381255)
                        = 0.5282817

Actual ratio:

    P2/P1 = 101 325 / 601 325 = 0.168503

`0.168503 < 0.528`, so the throat is sonic and the flow is **choked**. Nothing
downstream of the hole affects the flow rate. The margin is large — a mine line
would have to fall below about 91 kPa gauge before this stopped holding — which
is why the module treats the non-choked case as an error condition rather than
implementing a subsonic branch that could never run on a real reticulation line.

## Step 4 — Choked mass flow

    m_dot = 0.0404 x Cd x A x P1 / sqrt(T1)

    sqrt(293.15)                     = 17.121624

    0.0404 x 0.61                    = 0.024644
    0.024644 x 7.0685835e-6          = 1.7419817e-7
    1.7419817e-7 x 601 325           = 0.10474971
    0.10474971 / 17.121624           = 0.00611798

    m_dot = 0.00611798 kg/s  =  6.118 g/s

The leading constant is `sqrt(k/R) . (2/(k+1))^((k+1)/(2(k-1)))` for k = 1.4 and
R = 287 J/kg·K, which evaluates to 0.040418. The spec quotes it rounded to
0.0404 and the module uses the quoted figure, with a test that recomputes the
derivation and confirms the two agree.

## Step 5 — Free air delivered

Specific power is quoted per unit of free air at intake conditions, so the mass
flow has to be converted at the reference density, not at line density.

    rho_ref = P / (R T)
            = 101 325 / (287 x 293.15)
            = 101 325 / 84 134.05
            = 1.2043278 kg/m^3

    V_dot = 0.00611798 / 1.2043278
          = 0.00507999 m^3/s

    V_dot = 5.080 L/s   (about 10.8 cfm)

## Step 6 — Theoretical compressor power

Two stages, equal pressure ratio each, intercooled back to intake temperature.

    r_total = 601 325 / 101 325       = 5.9346163
    r_stage = sqrt(5.9346163)         = 2.4361075

    (n-1)/n = 0.35/1.35               = 0.2592593
    n/(n-1) = 1.35/0.35               = 3.8571429
    R T1    = 287 x 293.15            = 84 134.05

    r_stage^0.2592593
      = exp(0.2592593 x ln 2.4361075)
      = exp(0.2592593 x 0.8904015)
      = exp(0.2308448)
      = 1.2596637

    [ r_stage^((n-1)/n) - 1 ]         = 0.2596637

Per stage:

    W = m_dot x (n/(n-1)) x R T1 x [ ... ] / eta

    0.00611798 x 3.8571429            = 0.02359792
    0.02359792 x 84 134.05            = 1985.3886
    1985.3886 x 0.2596637             = 515.53325
    515.53325 / 0.75                  = 687.37767 W

Both stages:

    W_total = 2 x 687.37767 = 1374.755 W

    W_total = 1.374755 kW

## Step 7 — Annual energy

    1.374755 kW x 8760 h = 12 042.854 kWh/year

## Step 8 — Annual cost

**Not available.** `TARIFF` is null and no schedule has been entered, so the
module returns `null` with `costUnavailableReason: 'no-tariff-set'`.

It does not return R0. A leak with no tariff entered is a leak whose cost is
unknown, and that is a different statement from a leak that is free. The
register displays "tariff not set" against this row.

---

## The band — where the ±30% goes

The diameter is not measured. It is inferred from a person underground choosing
the closest description of what they heard. That inference carries roughly ±30%,
and it is by a wide margin the largest uncertainty in the calculation — far
larger than anything in the equations above.

    d_low      = 3 x 0.7 = 2.1 mm
    d_expected =           3.0 mm
    d_high     = 3 x 1.3 = 3.9 mm

Mass flow goes with **area**, and area goes with the **square** of diameter. So
the symmetric band on diameter does not stay symmetric:

    (2.1/3)^2 = 0.7^2 = 0.49        ->  -51%
    (3.9/3)^2 = 1.3^2 = 1.69        ->  +69%

Every step after the orifice — free air delivery, compressor power, annual
energy, annual cost — is directly proportional to mass flow. None of them
widens the band any further and none of them narrows it. So the −51%/+69%
established at the orifice is carried unchanged all the way to rand per year:

| | low (×0.49) | expected | high (×1.69) |
|---|---|---|---|
| diameter, mm | 2.100 | 3.000 | 3.900 |
| mass flow, g/s | 2.998 | 6.118 | 10.339 |
| free air, L/s | 2.489 | 5.080 | 8.585 |
| theoretical power, kW | 0.6736 | 1.3748 | 2.3233 |
| annual energy, kWh | 5 901 | 12 043 | 20 352 |
| annual cost, R | — | tariff not set | — |

**The band is not symmetric and must not be re-centred.** The midpoint of the
power band is

    (0.6736 + 2.3233) / 2 = 1.4985 kW

which is 9% above the expected value of 1.3748 kW. Reporting `1.50 ± 0.82 kW`
would be tidier and would be wrong. The high side of a squared band genuinely
is further out than the low side, and `uncertainty.ts` has a test asserting the
midpoint is *not* the expected value so that nobody flattens it later to make
the register look neater.

The honest way to read the result is:

> **0.67 to 2.32 kW.** Best estimate 1.37 kW.

Not `1.37 kW`. And certainly not `1.3748 kW`.

---

## Reconciliation with the code

Hand figures against `evaluateLeak({ leakTypeId: 'failed-hose-coupling' },
DEFAULT_CALC_SETTINGS)`:

| Quantity | By hand | Module | Agreement |
|---|---|---|---|
| orifice area, m² | 7.0685835e-6 | 7.0685835e-6 | 8 s.f. |
| pressure ratio | 0.168503 | 0.168502889 | 6 s.f. |
| mass flow, kg/s | 0.00611798 | 0.00611797787 | 6 s.f. |
| free air, L/s | 5.080 | 5.07999266 | 6 s.f. |
| theoretical power, kW | 1.374755 | 1.37475509 | 7 s.f. |
| annual energy, kWh | 12 042.854 | 12 042.8546 | 8 s.f. |
| band low ratio | 0.49 | 0.490000000 | exact |
| band high ratio | 1.69 | 1.690000000 | exact |
| power band midpoint, kW | 1.4985 | 1.49848305 | 6 s.f. |

The residual differences are rounding in the hand arithmetic, which was carried
to seven or eight figures at each step. Nothing here disagrees.

The same case is asserted in `src/calc/index.test.ts` under *"the hand-check
leak, end to end"*, so this reconciliation is re-checked on every test run
rather than only on the day it was written.

---

## Sanity checks

**Implied specific power.** 1.3748 kW for 5.080 L/s of free air is

    1.3748 / 0.00508 = 271 kW per m^3/s

Read this as a **floor**, not a prediction. It is idealised shaft work: it
excludes motor and drive losses, the part-load efficiency penalty a compressor
carries when it is not running at its best point, and the reticulation pressure
drop between the compressor house and the leak. A real machine's specific power
off site data will be higher, and the gap between the two is diagnostic. That
gap is exactly what the empirical method exists to close, and why the module
reports both figures side by side instead of averaging them.

**Order of magnitude.** A 3 mm hole losing about 1.4 kW continuously is the
right size of number for a single failed coupling. It is small enough that no
one would walk past it thinking it mattered, and that is the point of the tool:
a hundred of them on a level is 140 kW, and at any realistic tariff that is a
number worth someone's morning.

---

## What this check does not prove

- **That the orifice model fits this leak.** A blown coupling face is roughly a
  sharp-edged hole, which is the case the model suits best. A valve gland leak
  is a long tortuous path and the same model will overestimate it, in some cases
  substantially. Spec §11.
- **That 3 mm is the right diameter.** It is a catalogue default standing in for
  a measurement nobody took. The ±30% band is an honest statement about that,
  not a solution to it. An ultrasonic reading would be materially better.
- **That 0.75 is the right efficiency.** It is an assumption, it is stated on
  screen next to the figure it produces, and it is a settings field precisely so
  it can be pushed to 0.70 to see what moves.
- **That fixing this leak saves 1.37 kW.** It does not. Summed leak power is
  potential loss, not realised saving. Whether any of it is recovered depends on
  the compressor responding — unloading, reducing guide vane position, or being
  switched off. If it does not respond, the air that was leaking raises system
  pressure instead and power draw barely moves, while the higher pressure
  increases flow through every remaining leak. See `REALISED_SAVING_CAVEAT` in
  `src/calc/constants.ts`, which is the single source of that text for both the
  surface screen and the README.
