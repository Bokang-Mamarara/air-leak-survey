import { describe, expect, it } from 'vitest';

import { DEFAULT_CALC_SETTINGS } from './constants.ts';
import {
    freeAirDeliveryM3PerS,
    theoreticalPolytropicPowerKw,
    empiricalPowerKw,
} from './compressor.ts';
import { annualCostZar, annualEnergyKwh } from './cost.ts';
import { computePowerAndCost, unavailablePowerEstimate } from './powerAndCost.ts';
import type { CalcSettings, Range, TariffSchedule } from './types.ts';

/**
 * The same fictional schedule used in cost.test.ts and index.test.ts. Invented
 * for the tests and never to be copied into the application; the shipped
 * default is null.
 */
const TEST_TARIFF: TariffSchedule = {
    currency: 'ZAR',
    ratesZarPerKwh: {
        highDemandSeason: { peak: 6.0, standard: 1.9, offPeak: 1.05 },
        lowDemandSeason: { peak: 2.1, standard: 1.45, offPeak: 0.92 },
    },
    hoursPerYear: {
        highDemandSeason: { peak: 400, standard: 800, offPeak: 1008 },
        lowDemandSeason: { peak: 1100, standard: 2400, offPeak: 3052 },
    },
    source: 'Fictional schedule, powerAndCost.test.ts fixture',
};

/** Site compressor performance, kW per m3/s free air. A test fixture. */
const SITE_SPECIFIC_POWER = 350;

const withSiteData: CalcSettings = {
    ...DEFAULT_CALC_SETTINGS,
    compressor: {
        ...DEFAULT_CALC_SETTINGS.compressor,
        specificPowerKwPerM3PerSec: SITE_SPECIFIC_POWER,
        source: 'Compressor house performance test, powerAndCost.test.ts fixture',
    },
};

const withTariff: CalcSettings = {
    ...DEFAULT_CALC_SETTINGS,
    tariff: TEST_TARIFF,
};

/** An arbitrary but plausible mass-flow band — not tied to any one leak type. */
const massFlowKgPerS: Range = { low: 0.004, expected: 0.006118, high: 0.0119 };

function theoreticalAt(settings: CalcSettings, flow: number): number {
    return theoreticalPolytropicPowerKw({
        massFlowKgPerS: flow,
        spec: settings.compressor,
        atmosphericPressurePa: settings.atmosphericPressurePa,
    });
}

describe('computePowerAndCost — which method is preferred', () => {
    it('prefers the theoretical method, and reports the empirical one as null, when no site specific power is set', () => {
        const result = computePowerAndCost(massFlowKgPerS, DEFAULT_CALC_SETTINGS);

        expect(result.power.theoretical.preferred).toBe(true);
        expect(result.power.theoretical.powerKw).not.toBeNull();
        expect(result.power.empirical.preferred).toBe(false);
        expect(result.power.empirical.powerKw).toBeNull();
    });

    it('switches preference to the empirical method once a site specific power figure is entered', () => {
        const result = computePowerAndCost(massFlowKgPerS, withSiteData);

        expect(result.power.empirical.preferred).toBe(true);
        expect(result.power.empirical.powerKw).not.toBeNull();
        expect(result.power.theoretical.preferred).toBe(false);
        // Both methods are always returned side by side — the non-preferred one
        // does not disappear just because it lost the preference.
        expect(result.power.theoretical.powerKw).not.toBeNull();
    });

    it('actually uses the empirical figure for downstream energy once preferred, not just the flag', () => {
        const result = computePowerAndCost(massFlowKgPerS, withSiteData);

        const expectedEmpiricalPowerKw = empiricalPowerKw(
            freeAirDeliveryM3PerS(massFlowKgPerS.expected),
            SITE_SPECIFIC_POWER,
        ) as number;
        const theoreticalOnlyPowerKw = theoreticalAt(withSiteData, massFlowKgPerS.expected);

        const expectedEnergy = annualEnergyKwh(
            expectedEmpiricalPowerKw,
            withSiteData.operatingHoursPerYear,
        );
        const theoreticalOnlyEnergy = annualEnergyKwh(
            theoreticalOnlyPowerKw,
            withSiteData.operatingHoursPerYear,
        );

        expect(result.annualEnergyKwh.expected).toBeCloseTo(expectedEnergy, 6);
        // The theoretical and empirical methods disagree by construction (the
        // theoretical path assumes eta = 0.75 etc.), so if the switch had not
        // actually happened this would false-pass against the theoretical figure.
        expect(result.annualEnergyKwh.expected).not.toBeCloseTo(theoreticalOnlyEnergy, 3);
    });
});

describe('computePowerAndCost — annual energy falls back to the theoretical method', () => {
    it('computes annual energy from the theoretical power when no site data is present', () => {
        const result = computePowerAndCost(massFlowKgPerS, DEFAULT_CALC_SETTINGS);

        const expectedPowerKw = theoreticalAt(DEFAULT_CALC_SETTINGS, massFlowKgPerS.expected);
        const expectedEnergy = annualEnergyKwh(
            expectedPowerKw,
            DEFAULT_CALC_SETTINGS.operatingHoursPerYear,
        );

        expect(result.annualEnergyKwh.expected).toBeCloseTo(expectedEnergy, 6);
    });
});

describe('computePowerAndCost — a null tariff returns a null cost, never a zero one', () => {
    it('annualCostZar is null when no tariff is set, even though energy is a real, positive figure', () => {
        expect(DEFAULT_CALC_SETTINGS.tariff).toBeNull();

        const result = computePowerAndCost(massFlowKgPerS, DEFAULT_CALC_SETTINGS);

        expect(result.annualCostZar).toBeNull();
        expect(result.annualEnergyKwh.expected).toBeGreaterThan(0);
    });

    it('annualCostZar becomes a real band, computed from the preferred power, once a tariff is entered', () => {
        const result = computePowerAndCost(massFlowKgPerS, withTariff);

        expect(result.annualCostZar).not.toBeNull();

        const preferredPowerKw = theoreticalAt(withTariff, massFlowKgPerS.expected);
        const expectedCost = annualCostZar({
            powerKw: preferredPowerKw,
            tariff: TEST_TARIFF,
            operatingHoursPerYear: withTariff.operatingHoursPerYear,
        }) as number;

        expect(result.annualCostZar?.expected).toBeCloseTo(expectedCost, 4);
    });

    it('bands the cost across low/expected/high the same way it bands energy', () => {
        const result = computePowerAndCost(massFlowKgPerS, withTariff);

        expect(result.annualCostZar!.low).toBeLessThan(result.annualCostZar!.expected);
        expect(result.annualCostZar!.high).toBeGreaterThan(result.annualCostZar!.expected);
    });
});

describe('unavailablePowerEstimate', () => {
    it('reports a method that could not run without inventing a number', () => {
        const estimate = unavailablePowerEstimate('theoretical-polytropic', 'a test open line');

        expect(estimate.powerKw).toBeNull();
        expect(estimate.preferred).toBe(false);
        expect(estimate.basis).toContain('a test open line');
    });
});
