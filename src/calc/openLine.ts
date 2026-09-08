/**
 * `evaluateOpenLine` — cost one deliberate open line (refuge-bay
 * self-ventilation or an open line kept for cooling), spec section 4's two
 * "separate category" catalogue entries.
 *
 * This is deliberately not `evaluateLeak` run on an open line. A leak's
 * `equivalentDiameterMm` is an inferred fiction calibrated against what a
 * person underground heard or saw; an open line's stored diameter is a real,
 * measured nominal bore. Treating the two the same way — running the bore
 * through `evaluateLeak`'s diameter-uncertainty band and its idealised
 * "fully open" discharge coefficient — would apply an inference model built
 * for a guess to a number that was never a guess.
 *
 * So here the bore is a point value (it was measured, there is nothing to
 * band) and the discharge coefficient is banded instead: a cut pipe end, a
 * missing flange or a valve half off its seat is not a manufactured nozzle,
 * so how cleanly it actually discharges is the genuinely uncertain quantity.
 * From the mass-flow band onward the physics is identical to a leak's —
 * `computePowerAndCost` is shared — because a choked orifice is a choked
 * orifice regardless of why the opening exists.
 *
 * Costed, and totalled, but never in the leak table: see `summarise.ts`.
 */

import { KELVIN_AT_ZERO_CELSIUS, PA_PER_KPA } from './constants.ts';
import { findLeakType } from './catalogue.ts';
import { chokedMassFlowKgPerS, isChoked } from './orifice.ts';
import { computePowerAndCost, unavailablePowerEstimate } from './powerAndCost.ts';
import { coefficientBand, mapRange } from './uncertainty.ts';
import type { CalcSettings, LeakResult, Range } from './types.ts';

export interface OpenLineInput {
    leakTypeId: string;
    /** The line's real, measured nominal bore, mm. Never banded — see above. */
    boreMm: number;
    linePressureKpaG?: number | null;
    airTemperatureC?: number | null;
    /** Override for the assumed discharge coefficient at this specific opening. */
    dischargeCoefficient?: number | null;
}

export function evaluateOpenLine(
    input: OpenLineInput,
    settings: CalcSettings,
): LeakResult {
    const leakType = findLeakType(input.leakTypeId, settings.leakTypes);

    if (leakType.category !== 'deliberate-open-line') {
        throw new RangeError(
            `${leakType.label} is not a deliberate open line. evaluateOpenLine ` +
                'only runs the spec section 4 open-line catalogue entries; use ' +
                'evaluateLeak for anything in the leak category.',
        );
    }

    const dischargeCoefficientNominal =
        input.dischargeCoefficient ?? leakType.dischargeCoefficient;
    const linePressureKpaG = input.linePressureKpaG ?? settings.linePressureKpaG;
    const airTemperatureC = input.airTemperatureC ?? settings.airTemperatureC;

    const upstreamAbsolutePressurePa =
        linePressureKpaG * PA_PER_KPA + settings.atmosphericPressurePa;
    const upstreamTemperatureK = airTemperatureC + KELVIN_AT_ZERO_CELSIUS;
    const downstreamAbsolutePressurePa = settings.atmosphericPressurePa;

    const pressureRatio =
        downstreamAbsolutePressurePa / upstreamAbsolutePressurePa;
    const choked = isChoked(
        downstreamAbsolutePressurePa,
        upstreamAbsolutePressurePa,
    );

    const costUnavailableReason = settings.tariff === null ? 'no-tariff-set' : null;

    // Measured, not inferred — a point value, unlike a leak's banded diameter.
    const boreBand: Range = { low: input.boreMm, expected: input.boreMm, high: input.boreMm };

    if (!choked) {
        return {
            leakTypeId: leakType.id,
            category: leakType.category,
            equivalentDiameterMm: boreBand,
            // Not `'measured'`: that provenance value describes a leak's
            // diameter-band basis specifically (see types.ts). An open line's
            // band comes from the discharge coefficient, not the diameter —
            // its bore being measured is stated by `boreBand` having no
            // spread, not by this field.
            diameterProvenance: null,
            massFlowKgPerS: null,
            freeAirDeliveryLPerS: null,
            choked,
            pressureRatio,
            power: {
                theoretical: unavailablePowerEstimate('theoretical-polytropic', leakType.label),
                empirical: unavailablePowerEstimate('empirical-specific-power', leakType.label),
            },
            annualEnergyKwh: null,
            annualCostZar: null,
            costUnavailableReason,
            flowUnavailableReason: 'not-choked',
            unresolvedInputs: [],
        };
    }

    const dischargeCoefficientBand = coefficientBand(
        dischargeCoefficientNominal,
        settings.openLineDischargeCoefficientUncertaintyFraction,
    );

    const massFlowKgPerS = mapRange(dischargeCoefficientBand, (dischargeCoefficient) =>
        chokedMassFlowKgPerS({
            orificeDiameterMm: input.boreMm,
            dischargeCoefficient,
            upstreamAbsolutePressurePa,
            upstreamTemperatureK,
            downstreamAbsolutePressurePa,
        }).massFlowKgPerS,
    );

    const { freeAirDeliveryLPerS, power, annualEnergyKwh, annualCostZar } =
        computePowerAndCost(massFlowKgPerS, settings);

    return {
        leakTypeId: leakType.id,
        category: leakType.category,
        equivalentDiameterMm: boreBand,
        diameterProvenance: null,
        massFlowKgPerS,
        freeAirDeliveryLPerS,
        choked,
        pressureRatio,
        power,
        annualEnergyKwh,
        annualCostZar,
        costUnavailableReason,
        flowUnavailableReason: null,
        unresolvedInputs: [],
    };
}
