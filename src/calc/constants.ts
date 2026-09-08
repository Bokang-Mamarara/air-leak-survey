/**
 * Every number the calculation uses, named and sourced.
 *
 * Three kinds of value live here and the difference matters:
 *
 *   - Properties of air (k, R, and the two coefficients derived from them).
 *     Not settings. They do not change between mines.
 *   - Defaults that are stated assumptions — isentropic efficiency, polytropic
 *     exponent, stage count, line pressure, operating hours. Every one of these
 *     is a field on `CalcSettings` or `CompressorSpec` and is overridable from
 *     the settings screen. The value here is only the starting point.
 *   - Values that are simply not known: the tariff schedule and the site
 *     compressor specific power. These are null. A plausible fabricated number
 *     would be believed, which makes it worse than a blank field.
 */

import type {
    CalcSettings,
    CompressorSpec,
    LeakTypeDefinition,
    TariffSchedule,
} from './types.ts';

// ---------------------------------------------------------------------------
// Properties of air
// ---------------------------------------------------------------------------

/** Ratio of specific heats for air. Spec section 3.1. */
export const SPECIFIC_HEAT_RATIO_AIR = 1.4;

/** Specific gas constant for air, J/kg.K. Spec section 3.1. */
export const GAS_CONSTANT_AIR_J_PER_KG_K = 287;

/**
 * Critical pressure ratio for air: (2/(k+1))^(k/(k-1)) with k = 1.4, giving
 * 0.5283. Below this ratio the flow through the opening is sonic at the throat
 * and no longer depends on downstream conditions. A mine line at 400-500 kPa
 * gauge venting to atmosphere sits at about 0.17, so leaks are always choked.
 * Spec section 3.1.
 */
export const CRITICAL_PRESSURE_RATIO_AIR = 0.528;

/**
 * The lumped constant in the choked mass flow equation
 *
 *     m_dot = 0.0404 . Cd . A . P1 / sqrt(T1)
 *
 * equal to sqrt(k/R) . (2/(k+1))^((k+1)/(2(k-1))) with k = 1.4 and
 * R = 287 J/kg.K, which evaluates to 0.040418. Spec section 3.1 quotes 0.0404
 * and `constants.test.ts` checks the quoted figure against the derivation.
 *
 * Units: kg/s when A is m2, P1 is Pa absolute and T1 is K.
 */
export const CHOKED_FLOW_COEFFICIENT = 0.0404;

/**
 * Standard atmosphere at sea level, Pa. This is the downstream pressure a leak
 * discharges to.
 *
 * A working level on a deep-level mine is well below sea level and its
 * barometric pressure is materially higher, which raises the downstream
 * pressure and lowers the pressure ratio slightly. The flow is choked either
 * way, so this affects the absolute upstream pressure rather than the choking
 * decision. Overridable in settings.
 */
export const ATMOSPHERIC_PRESSURE_PA = 101325;

/**
 * Reference conditions for free air delivery, used to convert a mass flow into
 * the volumetric figure that compressor specific power is quoted against.
 * 101.325 kPa and 20 degrees C give a density of 1.204 kg/m3.
 */
export const FREE_AIR_REFERENCE_PRESSURE_PA = 101325;
export const FREE_AIR_REFERENCE_TEMPERATURE_K = 293.15;

/** Absolute zero offset, for degrees C to K. */
export const KELVIN_AT_ZERO_CELSIUS = 273.15;

/** Pa per kPa, so that gauge pressures entered in kPa convert without a literal. */
export const PA_PER_KPA = 1000;

// ---------------------------------------------------------------------------
// Discharge coefficients
// ---------------------------------------------------------------------------

/**
 * Discharge coefficients by opening geometry, spec section 3.1. Injected into
 * the orifice equation rather than hard-coded there, and overridable per leak
 * for a crew that has measured one.
 */
export const DISCHARGE_COEFFICIENTS = {
    /** Sharp-edged hole: a puncture, a split, a blown coupling face. */
    sharpEdged: 0.61,
    /** Rounded or nozzle-like opening: an open pipe end, a missing blank. */
    rounded: 0.8,
    /** Fully open line. */
    fullyOpen: 1.0,
} as const;

// ---------------------------------------------------------------------------
// Compressor defaults — assumptions, all overridable
// ---------------------------------------------------------------------------

/**
 * Polytropic exponent for a cooled compression path. Spec section 3.2 gives
 * n = 1.35, between isothermal (1.0) and the isentropic value for air (1.4),
 * which is what intercooling buys.
 */
export const POLYTROPIC_EXPONENT_COOLED = 1.35;

/**
 * Isentropic efficiency assumed for the theoretical path when no site figure
 * exists. 0.75 is a stated assumption, not a measurement, and the estimate
 * carries that in its `basis` string so it is visible on screen.
 *
 * This is a settings input, not a fixed constant: the theoretical method exists
 * for the no-site-data case, and pushing this to 0.70 to see what moves is a
 * reasonable first thing to do with the tool.
 */
export const DEFAULT_ISENTROPIC_EFFICIENCY = 0.75;

/**
 * Stages assumed for the theoretical path, each taking an equal share of the
 * total pressure ratio and intercooled back to inlet temperature. Two stages
 * suits the ratio of roughly 6 that a 500 kPa gauge reticulation implies.
 * Assumption, overridable.
 */
export const DEFAULT_COMPRESSOR_STAGE_COUNT = 2;

/**
 * Mine reticulation runs at 400-500 kPa gauge (spec section 3.1). The upper end
 * is used as the default because it is the conservative choice for a leak
 * estimate. Set per level in settings once real line pressures are known.
 */
export const DEFAULT_LINE_PRESSURE_KPA_G = 500;

/**
 * Air temperature in the line, degrees C. Reticulated air underground has been
 * through aftercoolers and a long pipe run, so it sits near ambient rather than
 * near discharge temperature. Assumption, overridable.
 */
export const DEFAULT_AIR_TEMPERATURE_C = 20;

/**
 * Hours in a year. A calendar fact, and the ceiling on both a leak's operating
 * hours and a tariff schedule's total hours. Kept separate from the operating
 * hours default below because the two mean different things and only happen to
 * share a value.
 */
export const HOURS_PER_YEAR = 8760;

/**
 * Hours per year a leak is pressurised. Mines run continuously (spec section
 * 3.3), so the default is every hour of the year. A section that is isolated
 * between shifts should have this reduced in settings.
 */
export const DEFAULT_OPERATING_HOURS_PER_YEAR = HOURS_PER_YEAR;

/**
 * Site compressor specific power, kW per m3/s of free air delivered. Null: this
 * has to come from the mine's own compressor performance data. Where it is
 * present it beats the theoretical figure and the tool says so; where it is
 * absent the theoretical method carries the estimate on stated assumptions.
 */
export const COMPRESSOR_SPECIFIC_POWER_KW_PER_M3_PER_S: number | null = null;

/** The starting compressor specification. Every field is editable in settings. */
export const DEFAULT_COMPRESSOR_SPEC: CompressorSpec = {
    specificPowerKwPerM3PerSec: COMPRESSOR_SPECIFIC_POWER_KW_PER_M3_PER_S,
    polytropicExponent: POLYTROPIC_EXPONENT_COOLED,
    isentropicEfficiency: DEFAULT_ISENTROPIC_EFFICIENCY,
    stageCount: DEFAULT_COMPRESSOR_STAGE_COUNT,
    dischargePressureKpaG: DEFAULT_LINE_PRESSURE_KPA_G,
    inletTemperatureC: DEFAULT_AIR_TEMPERATURE_C,
    source: null,
};

// ---------------------------------------------------------------------------
// Tariff
// ---------------------------------------------------------------------------

/**
 * Time-of-use tariff schedule. Null, and it stays null until someone types a
 * real one in. Rates change annually, they differ by supply agreement, and an
 * invented number here would propagate into every rand figure the tool
 * produces. `cost.ts` returns null rather than zero while this is unset.
 */
export const TARIFF: TariffSchedule | null = null;

// ---------------------------------------------------------------------------
// Uncertainty
// ---------------------------------------------------------------------------

/**
 * Fractional half-width of the equivalent-diameter band, applied uniformly to
 * every catalogue entry.
 *
 * This is engineering judgement, not a measured distribution: the input is a
 * person underground choosing the closest description of what they heard, so
 * the diameter is uncertain at roughly this order. Flow goes with the square of
 * diameter, so plus or minus 30 percent on diameter becomes about minus 51 to
 * plus 69 percent on flow, and the arithmetic in `uncertainty.ts` is written to
 * make that visible rather than to hide it.
 *
 * Ultrasonic measurement would justify a much tighter band, which is why
 * `LeakInput` takes a diameter override.
 */
export const DIAMETER_UNCERTAINTY_FRACTION = 0.3;

/**
 * Discharge coefficient for a deliberately opened line — spec section 4's
 * two self-ventilation and cooling categories.
 *
 * Phase 1 carried these at `DISCHARGE_COEFFICIENTS.fullyOpen` (1.0), an
 * idealised fully-open bore. Phase 5 decision: a line opened by removing a
 * blank, cracking a valve, or cutting a hose end discharges more like a
 * rounded, nozzle-like opening than either a knife-edged puncture or a
 * perfectly clean bore, so `rounded` (0.8) — the middle of the three named
 * coefficients — is the better physical match. See the 2026-09-08 entry in
 * DECISIONS.md for the full reasoning, including why the bore itself is
 * still not banded the way a leak's equivalent diameter is.
 */
export const OPEN_LINE_DISCHARGE_COEFFICIENT = DISCHARGE_COEFFICIENTS.rounded;

/**
 * Fractional half-width of the discharge-coefficient band `evaluateOpenLine`
 * applies to `OPEN_LINE_DISCHARGE_COEFFICIENT`.
 *
 * An open line's bore is a real, measured nominal pipe size — not inferred
 * from a catalogue guess the way a leak's equivalent diameter is — so it is
 * treated as a point value (`openLine.ts`) rather than banded. What is
 * genuinely uncertain instead is how the opened end actually discharges: an
 * unbevelled cut, a missing flange, a valve half off its seat could
 * plausibly sit anywhere from close to a sharp-edged orifice up to an
 * idealised fully-open bore. 0.8 x (1 +/- 0.25) spans 0.6 to 1.0, bracketing
 * `DISCHARGE_COEFFICIENTS.sharpEdged` (0.61) and `.fullyOpen` (1.0) — the
 * genuine range of how ragged or clean a real opened line end turns out to
 * be, rather than an invented figure.
 */
export const OPEN_LINE_DISCHARGE_COEFFICIENT_UNCERTAINTY_FRACTION = 0.25;

// ---------------------------------------------------------------------------
// Leak type catalogue — spec section 4
// ---------------------------------------------------------------------------

/**
 * What the person underground picks from. The last two entries are not leaks.
 * They are deliberate open valves compensating for a ventilation shortfall, the
 * fix is a ventilation intervention rather than a maintenance job, and they are
 * never totalled into the leak total.
 */
export const LEAK_TYPE_CATALOGUE: readonly LeakTypeDefinition[] = [
    {
        id: 'pinhole-in-hose',
        label: 'Pinhole in hose',
        category: 'leak',
        equivalentDiameterMm: 1,
        dischargeCoefficient: DISCHARGE_COEFFICIENTS.sharpEdged,
        basis: 'Spec section 4. Puncture through the hose wall, sharp edged.',
    },
    {
        id: 'failed-hose-coupling',
        label: 'Failed hose coupling',
        category: 'leak',
        equivalentDiameterMm: 3,
        dischargeCoefficient: DISCHARGE_COEFFICIENTS.sharpEdged,
        basis: 'Spec section 4, noted as the most common finding.',
    },
    {
        id: 'valve-gland-packing',
        label: 'Valve gland / packing',
        category: 'leak',
        equivalentDiameterMm: 2,
        dischargeCoefficient: DISCHARGE_COEFFICIENTS.sharpEdged,
        basis:
            'Spec section 4. The real path through packing is long and ' +
            'tortuous, so an orifice model overestimates this one more than ' +
            'the others. Listed as a known limitation, spec section 11.',
    },
    {
        id: 'damaged-flexible-hose',
        label: 'Damaged flexible hose',
        category: 'leak',
        equivalentDiameterMm: 6,
        dischargeCoefficient: DISCHARGE_COEFFICIENTS.sharpEdged,
        basis: 'Spec section 4. Split or abraded hose, torn edge.',
    },
    {
        id: 'missing-blank-open-branch',
        label: 'Missing blank / open branch',
        category: 'leak',
        equivalentDiameterMm: 12,
        dischargeCoefficient: DISCHARGE_COEFFICIENTS.rounded,
        basis:
            'Spec section 4. The opening is a machined pipe or fitting bore ' +
            'rather than a torn edge, so the rounded coefficient applies. ' +
            'Still a leak, not a deliberate open line: nobody opened it on ' +
            'purpose to move air.',
    },
    {
        id: 'drill-rig-connection',
        label: 'Drill rig connection',
        category: 'leak',
        equivalentDiameterMm: 4,
        dischargeCoefficient: DISCHARGE_COEFFICIENTS.sharpEdged,
        basis: 'Spec section 4. Worn claw coupling or perished seal.',
    },
    {
        id: 'refuge-bay-self-ventilation',
        label: 'Refuge bay self-ventilation',
        category: 'deliberate-open-line',
        equivalentDiameterMm: null,
        dischargeCoefficient: OPEN_LINE_DISCHARGE_COEFFICIENT,
        basis:
            'Spec section 4, separate category. Diameter is the bore of the ' +
            'branch that was opened, which only the person on site knows, so ' +
            'it is asked for rather than assumed. Discharge coefficient is ' +
            'the rounded/nozzle-like value, not an idealised fully-open bore ' +
            '— see OPEN_LINE_DISCHARGE_COEFFICIENT above.',
    },
    {
        id: 'open-line-for-cooling',
        label: 'Open line for cooling',
        category: 'deliberate-open-line',
        equivalentDiameterMm: null,
        dischargeCoefficient: OPEN_LINE_DISCHARGE_COEFFICIENT,
        basis:
            'Spec section 4, separate category. A ventilation shortfall being ' +
            'compensated with compressed air. Diameter asked for, not assumed. ' +
            'Discharge coefficient is the rounded/nozzle-like value — see ' +
            'OPEN_LINE_DISCHARGE_COEFFICIENT above.',
    },
];

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/**
 * The starting point for the settings screen. The two unknowable values are
 * null; everything else is a stated assumption the user can change.
 */
export const DEFAULT_CALC_SETTINGS: CalcSettings = {
    atmosphericPressurePa: ATMOSPHERIC_PRESSURE_PA,
    linePressureKpaG: DEFAULT_LINE_PRESSURE_KPA_G,
    airTemperatureC: DEFAULT_AIR_TEMPERATURE_C,
    operatingHoursPerYear: DEFAULT_OPERATING_HOURS_PER_YEAR,
    diameterUncertaintyFraction: DIAMETER_UNCERTAINTY_FRACTION,
    openLineDischargeCoefficientUncertaintyFraction:
        OPEN_LINE_DISCHARGE_COEFFICIENT_UNCERTAINTY_FRACTION,
    leakTypes: LEAK_TYPE_CATALOGUE,
    compressor: DEFAULT_COMPRESSOR_SPEC,
    tariff: TARIFF,
};

// ---------------------------------------------------------------------------
// The caveat
// ---------------------------------------------------------------------------

/**
 * Spec section 3.4. One string, imported by the surface screen and quoted in
 * the README, so the two cannot drift apart. It is not a field on every result
 * because it is a property of the method, not of any individual leak.
 */
export const REALISED_SAVING_CAVEAT =
    'Summed leak power is potential loss, not realised saving. Fixing a leak ' +
    'only saves energy if the compressor responds by unloading, reducing ' +
    'guide vane position, or being switched off. If it does not, the ' +
    'recovered air raises system pressure and power draw barely moves, while ' +
    'the higher pressure increases flow through every remaining leak.';
