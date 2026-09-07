/**
 * Types for the calculation layer.
 *
 * Nothing in this folder imports React, touches storage, reads the network or
 * asks the clock for the time. Every function here takes inputs and returns
 * outputs, which is what makes the physics reviewable on its own.
 *
 * Two rules are enforced by these types rather than by discipline:
 *
 *   1. Every energy and cost figure is a `Range`, never a single number. There
 *      is no `number` energy or cost anywhere in the public surface.
 *   2. The two compressor power methods are held in separate named fields with
 *      no combined field, so there is nowhere to put an average of them.
 */

/**
 * A band, not a point value. Equivalent diameter is inferred from a leak-type
 * catalogue, so every figure derived from it carries real uncertainty. Flow
 * goes with the square of diameter, so the output band is wider than the input
 * band — see `uncertainty.ts`.
 */
export interface Range {
    low: number;
    expected: number;
    high: number;
}

/**
 * Deliberate open lines are not leaks. They are open valves compensating for a
 * ventilation shortfall, and the fix is a ventilation intervention rather than
 * a maintenance job. They are costed the same way and totalled separately.
 */
export type LeakCategory = 'leak' | 'deliberate-open-line';

/**
 * One row of the catalogue the person underground picks from. They have no flow
 * meter, so the input is a description of what they heard or saw and the tool
 * infers an equivalent orifice from it.
 */
export interface LeakTypeDefinition {
    id: string;
    label: string;
    category: LeakCategory;
    /**
     * Null where the opening has no catalogue diameter — an open line is the
     * bore of whatever branch was opened, which only the person on site knows.
     * A null here means the tool asks; it never means zero.
     */
    equivalentDiameterMm: number | null;
    dischargeCoefficient: number;
    /** Why this diameter and this discharge coefficient. */
    basis: string;
}

/**
 * The calculation-layer view of a logged leak. Deliberately not the stored
 * record: position, photo, timestamps and sync state belong to `LeakRecord`,
 * which arrives with persistence in Phase 3. Everything optional here falls
 * back to `CalcSettings`, then to a named constant.
 */
export interface LeakInput {
    leakTypeId: string;
    /** Measured or overridden diameter, where the crew carries an instrument. */
    equivalentDiameterMm?: number | null;
    linePressureKpaG?: number | null;
    airTemperatureC?: number | null;
    dischargeCoefficient?: number | null;
}

/**
 * Peak, standard and off-peak. Used both for rates and for the hours spent in
 * each period, which is why the field names carry no units — the container
 * names them.
 */
export interface TimeOfUseSplit {
    peak: number;
    standard: number;
    offPeak: number;
}

/**
 * A time-of-use tariff. Mines run continuously, so a leak costs different
 * amounts at different hours and a single blended rate understates the value of
 * leaks in continuously pressurised sections.
 *
 * There is no default for this type. Tariffs change annually, and a fabricated
 * rate would be believed.
 */
export interface TariffSchedule {
    currency: 'ZAR';
    ratesZarPerKwh: {
        highDemandSeason: TimeOfUseSplit;
        lowDemandSeason: TimeOfUseSplit;
    };
    /** Hours spent in each period over a year. Must sum to the operating hours. */
    hoursPerYear: {
        highDemandSeason: TimeOfUseSplit;
        lowDemandSeason: TimeOfUseSplit;
    };
    /** Which published schedule this came from, and who entered it. */
    source: string;
}

/**
 * Compressor characteristics. Every field is a settings input rather than a
 * fixed constant, including the efficiency and the polytropic exponent: the
 * theoretical method exists precisely for the case where no site data is
 * available, and the first thing anyone with compressor experience will want to
 * do is push the efficiency down and watch what moves.
 */
export interface CompressorSpec {
    /**
     * Site specific power, kW per m3/s of free air delivered. Null until a real
     * compressor performance figure is entered. Where it is present it beats
     * the theoretical number and the tool says so.
     */
    specificPowerKwPerM3PerSec: number | null;
    /** n, for a cooled compression path. */
    polytropicExponent: number;
    /** An assumption unless a site figure replaces it. */
    isentropicEfficiency: number;
    /** Stages, each with equal pressure ratio and intercooled back to inlet. */
    stageCount: number;
    dischargePressureKpaG: number;
    inletTemperatureC: number;
    /** Where the numbers came from, or null while they are assumptions. */
    source: string | null;
}

/**
 * One of the two power methods. Both are always returned; `preferred` says
 * which one to lead with, and `basis` is the provenance shown on screen next to
 * the figure — "theoretical, eta = 0.75 assumed" is the whole point of showing
 * both.
 */
export interface CompressorPowerEstimate {
    method: 'theoretical-polytropic' | 'empirical-specific-power';
    /** Null when the method cannot run — no site specific power, for instance. */
    powerKw: Range | null;
    preferred: boolean;
    basis: string;
}

/**
 * The output of `evaluateLeak`. Null in a numeric field always means "not
 * known", never zero; `unresolvedInputs` names what is missing.
 */
export interface LeakResult {
    leakTypeId: string;
    category: LeakCategory;
    equivalentDiameterMm: Range | null;
    massFlowKgPerS: Range | null;
    freeAirDeliveryLPerS: Range | null;
    /** False only if someone supplies a line pressure below the critical ratio. */
    choked: boolean;
    /** Downstream over upstream, absolute. Choked below 0.528 for air. */
    pressureRatio: number;
    /**
     * Why there are no flow figures, when there are none.
     *
     * `diameter-not-set` is a question for the user — an open line whose bore
     * nobody has entered. `not-choked` is a statement about the model: the line
     * pressure given is too low for the choked assumption, so the tool declines
     * to answer rather than applying the equation outside its range.
     */
    flowUnavailableReason: 'diameter-not-set' | 'not-choked' | null;
    /** Two methods, side by side. There is deliberately no combined field. */
    power: {
        theoretical: CompressorPowerEstimate;
        empirical: CompressorPowerEstimate;
    };
    annualEnergyKwh: Range | null;
    annualCostZar: Range | null;
    costUnavailableReason: 'no-tariff-set' | null;
    /** Field names the user still has to supply, e.g. an open line's bore. */
    unresolvedInputs: string[];
}

/**
 * Everything the calculation needs that is not a property of the individual
 * leak. All of it is editable on the settings screen; `DEFAULT_CALC_SETTINGS`
 * in `constants.ts` is the starting point, with the two unknowable values null.
 */
export interface CalcSettings {
    atmosphericPressurePa: number;
    linePressureKpaG: number;
    airTemperatureC: number;
    operatingHoursPerYear: number;
    /** Fractional half-width of the equivalent-diameter band, e.g. 0.3 for +-30%. */
    diameterUncertaintyFraction: number;
    leakTypes: readonly LeakTypeDefinition[];
    compressor: CompressorSpec;
    tariff: TariffSchedule | null;
}
