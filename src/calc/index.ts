/**
 * The public entry point of the calculation layer.
 *
 * One call in, one banded result out:
 *
 *     evaluateLeak(input, settings) -> LeakResult
 *
 * The chain it runs, and where each step lives:
 *
 *     leak type + overrides          this file
 *       -> equivalent diameter band  uncertainty.ts
 *       -> choked mass flow          orifice.ts
 *       -> free air delivered        compressor.ts
 *       -> compressor power, twice   compressor.ts
 *       -> annual energy and cost    cost.ts
 *
 * The band is carried by running the low, expected and high diameters through
 * the identical functions, so there is no second implementation of the physics
 * for the ends of the range.
 *
 * Nothing in this folder imports React, reads storage, calls the network or
 * asks for the time. `evaluateLeak` is a pure function: the same inputs give
 * the same result, and neither argument is modified.
 *
 * Two things this file deliberately does not do. It does not total leaks — that
 * is Phase 5, and when it is written it belongs here in `src/calc` rather than
 * in a component, because keeping deliberate open lines out of the leak total
 * is a domain rule and not a display choice. And it does not attach the
 * realised-saving caveat to each result; the caveat is a property of the
 * method, exported once as `REALISED_SAVING_CAVEAT` in `constants.ts`.
 */

import {
    KELVIN_AT_ZERO_CELSIUS,
    PA_PER_KPA,
} from './constants.ts';
import {
    compressorPower,
    freeAirDeliveryM3PerS,
    theoreticalPolytropicPowerKw,
} from './compressor.ts';
import { annualCostZar, annualEnergyKwh } from './cost.ts';
import { chokedMassFlowKgPerS, isChoked } from './orifice.ts';
import { diameterBandMm, mapRange } from './uncertainty.ts';
import type {
    CalcSettings,
    CompressorPowerEstimate,
    LeakInput,
    LeakResult,
    LeakTypeDefinition,
    Range,
} from './types.ts';

export { DEFAULT_CALC_SETTINGS, REALISED_SAVING_CAVEAT } from './constants.ts';
export type {
    CalcSettings,
    CompressorSpec,
    LeakCategory,
    LeakInput,
    LeakResult,
    LeakTypeDefinition,
    Range,
    TariffSchedule,
} from './types.ts';

/**
 * Cost one leak, with every energy and money figure returned as a band.
 *
 * Throws only when the leak type id is not in the catalogue, which is a wiring
 * fault rather than anything a person underground could cause. Every genuine
 * gap in the data — no bore on an open line, no tariff, no site compressor
 * figure — comes back as a null with a reason beside it, never as a zero.
 */
export function evaluateLeak(
    input: LeakInput,
    settings: CalcSettings,
): LeakResult {
    const leakType = findLeakType(input.leakTypeId, settings.leakTypes);

    // `??` takes the left side unless it is null or undefined. Unlike `||` it
    // does not treat 0 as absent, which matters for a diameter override.
    const dischargeCoefficient =
        input.dischargeCoefficient ?? leakType.dischargeCoefficient;
    const linePressureKpaG =
        input.linePressureKpaG ?? settings.linePressureKpaG;
    const airTemperatureC = input.airTemperatureC ?? settings.airTemperatureC;
    const nominalDiameterMm =
        input.equivalentDiameterMm ?? leakType.equivalentDiameterMm;

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

    // Two ways there is nothing to compute. Neither is an error: one is a
    // question for the user, the other is the model declining to answer outside
    // its range.
    if (nominalDiameterMm === null || !choked) {
        return {
            leakTypeId: leakType.id,
            category: leakType.category,
            equivalentDiameterMm: null,
            massFlowKgPerS: null,
            freeAirDeliveryLPerS: null,
            choked,
            pressureRatio,
            power: {
                theoretical: unavailable('theoretical-polytropic', leakType),
                empirical: unavailable('empirical-specific-power', leakType),
            },
            annualEnergyKwh: null,
            annualCostZar: null,
            costUnavailableReason,
            flowUnavailableReason:
                nominalDiameterMm === null ? 'diameter-not-set' : 'not-choked',
            unresolvedInputs:
                nominalDiameterMm === null ? ['equivalentDiameterMm'] : [],
        };
    }

    const equivalentDiameterMm = diameterBandMm(
        nominalDiameterMm,
        settings.diameterUncertaintyFraction,
    );

    const massFlowKgPerS = mapRange(
        equivalentDiameterMm,
        (orificeDiameterMm) =>
            chokedMassFlowKgPerS({
                orificeDiameterMm,
                dischargeCoefficient,
                upstreamAbsolutePressurePa,
                upstreamTemperatureK,
                downstreamAbsolutePressurePa,
            }).massFlowKgPerS,
    );

    const freeAirM3PerS = mapRange(massFlowKgPerS, freeAirDeliveryM3PerS);

    const compressorInput = {
        spec: settings.compressor,
        atmosphericPressurePa: settings.atmosphericPressurePa,
    };

    // Called once at the expected flow purely for the labelling — which method
    // is preferred, and the basis string that appears next to the figure.
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
        leakTypeId: leakType.id,
        category: leakType.category,
        equivalentDiameterMm,
        massFlowKgPerS,
        freeAirDeliveryLPerS: mapRange(freeAirM3PerS, (value) => value * 1000),
        choked,
        pressureRatio,
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
        costUnavailableReason,
        flowUnavailableReason: null,
        unresolvedInputs: [],
    };
}

function findLeakType(
    leakTypeId: string,
    catalogue: readonly LeakTypeDefinition[],
): LeakTypeDefinition {
    const leakType = catalogue.find((type) => type.id === leakTypeId);

    if (leakType === undefined) {
        throw new RangeError(
            `Unknown leak type "${leakTypeId}". The catalogue holds: ` +
                `${catalogue.map((type) => type.id).join(', ')}.`,
        );
    }

    return leakType;
}

/** A method that could not run at all, with the reason it could not. */
function unavailable(
    method: CompressorPowerEstimate['method'],
    leakType: LeakTypeDefinition,
): CompressorPowerEstimate {
    return {
        method,
        powerKw: null,
        preferred: false,
        basis: `No flow figure for ${leakType.label}, so there is no power figure.`,
    };
}

/**
 * Several functions here return `number | null` because the null case is real —
 * no tariff, no site compressor data. At the point of use that case has already
 * been ruled out by an earlier check. This states the reasoning rather than
 * asserting it, so that if the reasoning ever stops holding it fails loudly
 * instead of putting a null into a band.
 */
function definitely(value: number | null, source: string): number {
    if (value === null) {
        throw new Error(
            `${source} returned null after its null case was ruled out. ` +
                'This is a fault in evaluateLeak, not a gap in the data.',
        );
    }

    return value;
}
