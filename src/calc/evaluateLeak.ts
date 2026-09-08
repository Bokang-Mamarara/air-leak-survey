/**
 * `evaluateLeak` — cost one logged leak, with every energy and money figure
 * returned as a band.
 *
 * The chain it runs:
 *
 *     leak type + overrides          this file
 *       -> equivalent diameter band  uncertainty.ts
 *       -> choked mass flow          orifice.ts
 *       -> free air, power, cost     powerAndCost.ts
 *
 * The band is carried by running the low, expected and high diameters through
 * the identical functions, so there is no second implementation of the
 * physics for the ends of the range.
 *
 * Nothing in this folder imports React, reads storage, calls the network or
 * asks for the time. `evaluateLeak` is a pure function: the same inputs give
 * the same result, and neither argument is modified.
 *
 * This is the leak path only. A deliberate open line's stored diameter is a
 * real, measured nominal bore rather than an inferred equivalent diameter —
 * see `openLine.ts`, which runs a separate calculation that never treats a
 * bore as this file's `nominalDiameterMm`.
 */

import { KELVIN_AT_ZERO_CELSIUS, PA_PER_KPA } from './constants.ts';
import { findLeakType } from './catalogue.ts';
import { chokedMassFlowKgPerS, isChoked } from './orifice.ts';
import { computePowerAndCost, unavailablePowerEstimate } from './powerAndCost.ts';
import { diameterBandMm, mapRange } from './uncertainty.ts';
import type { CalcSettings, LeakInput, LeakResult } from './types.ts';

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
    // question for the user, the other is the model declining to answer
    // outside its range.
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
                theoretical: unavailablePowerEstimate('theoretical-polytropic', leakType.label),
                empirical: unavailablePowerEstimate('empirical-specific-power', leakType.label),
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

    const { freeAirDeliveryLPerS, power, annualEnergyKwh, annualCostZar } =
        computePowerAndCost(massFlowKgPerS, settings);

    return {
        leakTypeId: leakType.id,
        category: leakType.category,
        equivalentDiameterMm,
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
