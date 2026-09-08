/**
 * The tail both `evaluateLeak` and `evaluateOpenLine` share: once a mass-flow
 * band exists, free air delivery, both compressor power methods, annual
 * energy and annual cost are computed identically regardless of whether the
 * flow came from a leak's banded equivalent diameter or an open line's
 * banded discharge coefficient. Extracted here so that identical logic is
 * not maintained in two places, and so the physics stays out of the
 * dispatch decision in `summarise.ts`.
 */

import {
    compressorPower,
    freeAirDeliveryM3PerS,
    theoreticalPolytropicPowerKw,
} from './compressor.ts';
import { annualCostZar, annualEnergyKwh } from './cost.ts';
import { mapRange } from './uncertainty.ts';
import type { CalcSettings, CompressorPowerEstimate, Range } from './types.ts';

export interface PowerAndCost {
    freeAirDeliveryLPerS: Range;
    power: {
        theoretical: CompressorPowerEstimate;
        empirical: CompressorPowerEstimate;
    };
    annualEnergyKwh: Range;
    annualCostZar: Range | null;
}

/** Given a mass-flow band and the settings in force, the rest of `LeakResult`. */
export function computePowerAndCost(
    massFlowKgPerS: Range,
    settings: CalcSettings,
): PowerAndCost {
    const compressorInput = {
        spec: settings.compressor,
        atmosphericPressurePa: settings.atmosphericPressurePa,
    };

    const freeAirM3PerS = mapRange(massFlowKgPerS, freeAirDeliveryM3PerS);

    // Called once at the expected flow purely for the labelling — which
    // method is preferred, and the basis string that appears next to the
    // figure.
    const labels = compressorPower({
        massFlowKgPerS: massFlowKgPerS.expected,
        ...compressorInput,
    });

    const theoreticalPowerKw = mapRange(massFlowKgPerS, (flow) =>
        theoreticalPolytropicPowerKw({ massFlowKgPerS: flow, ...compressorInput }),
    );

    const specificPower = settings.compressor.specificPowerKwPerM3PerSec;
    const empiricalPowerKw: Range | null =
        specificPower === null
            ? null
            : mapRange(freeAirM3PerS, (fad) => fad * specificPower);

    const preferredPowerKw =
        empiricalPowerKw !== null && labels.empirical.preferred
            ? empiricalPowerKw
            : theoreticalPowerKw;

    const annualEnergy = mapRange(preferredPowerKw, (powerKw) =>
        annualEnergyKwh(powerKw, settings.operatingHoursPerYear),
    );

    const tariff = settings.tariff;
    const annualCost: Range | null =
        tariff === null
            ? null
            : mapRange(preferredPowerKw, (powerKw) =>
                  definitely(
                      annualCostZar({
                          powerKw,
                          tariff,
                          operatingHoursPerYear: settings.operatingHoursPerYear,
                      }),
                      'annualCostZar',
                  ),
              );

    return {
        freeAirDeliveryLPerS: mapRange(freeAirM3PerS, (value) => value * 1000),
        power: {
            theoretical: {
                method: labels.theoretical.method,
                powerKw: theoreticalPowerKw,
                preferred: labels.theoretical.preferred,
                basis: labels.theoretical.basis,
            },
            empirical: {
                method: labels.empirical.method,
                powerKw: empiricalPowerKw,
                preferred: labels.empirical.preferred,
                basis: labels.empirical.basis,
            },
        },
        annualEnergyKwh: annualEnergy,
        annualCostZar: annualCost,
    };
}

/** A method that could not run at all, with the reason it could not. */
export function unavailablePowerEstimate(
    method: CompressorPowerEstimate['method'],
    subjectLabel: string,
): CompressorPowerEstimate {
    return {
        method,
        powerKw: null,
        preferred: false,
        basis: `No flow figure for ${subjectLabel}, so there is no power figure.`,
    };
}

/**
 * Several functions here return `number | null` because the null case is
 * real — no tariff, no site compressor data. At the point of use that case
 * has already been ruled out by an earlier check. This states the reasoning
 * rather than asserting it, so that if the reasoning ever stops holding it
 * fails loudly instead of putting a null into a band.
 */
function definitely(value: number | null, source: string): number {
    if (value === null) {
        throw new Error(
            `${source} returned null after its null case was ruled out. ` +
                'This is a fault in the caller, not a gap in the data.',
        );
    }

    return value;
}
