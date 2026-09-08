import { describe, expect, it } from 'vitest';

import {
    DEFAULT_CALC_SETTINGS,
    OPEN_LINE_DISCHARGE_COEFFICIENT,
    OPEN_LINE_DISCHARGE_COEFFICIENT_UNCERTAINTY_FRACTION,
} from './constants.ts';
import { evaluateOpenLine, type OpenLineInput } from './openLine.ts';
import type { CalcSettings, Range, TariffSchedule } from './types.ts';

/** Same fictional schedule used elsewhere in the suite. Never the shipped default. */
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
    source: 'Fictional schedule, openLine.test.ts fixture',
};

const withTariff: CalcSettings = { ...DEFAULT_CALC_SETTINGS, tariff: TEST_TARIFF };

const refugeBay: OpenLineInput = {
    leakTypeId: 'refuge-bay-self-ventilation',
    boreMm: 25,
};

function bandRatios(range: Range): { low: number; high: number } {
    return { low: range.low / range.expected, high: range.high / range.expected };
}

describe('evaluateOpenLine', () => {
    it('refuses a leak-category type — this function is for the two open-line entries only', () => {
        expect(() =>
            evaluateOpenLine({ leakTypeId: 'failed-hose-coupling', boreMm: 25 }, DEFAULT_CALC_SETTINGS),
        ).toThrow(/not a deliberate open line|open line/i);
    });

    it('stays in the deliberate-open-line category', () => {
        const result = evaluateOpenLine(refugeBay, withTariff);

        expect(result.category).toBe('deliberate-open-line');
        expect(result.leakTypeId).toBe('refuge-bay-self-ventilation');
    });

    it('carries the bore as a point value, not a band — it was measured, not inferred', () => {
        const result = evaluateOpenLine(refugeBay, withTariff);

        expect(result.equivalentDiameterMm).toEqual({ low: 25, expected: 25, high: 25 });
    });

    it('confirms the flow is choked at a mine line pressure', () => {
        const result = evaluateOpenLine(refugeBay, withTariff);

        expect(result.choked).toBe(true);
        expect(result.flowUnavailableReason).toBeNull();
    });

    it('bands the discharge coefficient at the named nominal and fraction, not the diameter', () => {
        const result = evaluateOpenLine(refugeBay, withTariff);
        const ratios = bandRatios(result.massFlowKgPerS as Range);

        // Mass flow is linear in Cd (diameter held fixed), so the flow band's
        // ratios equal the Cd band's ratios directly: 0.6/0.8 and 1.0/0.8.
        expect(ratios.low).toBeCloseTo(
            (OPEN_LINE_DISCHARGE_COEFFICIENT * (1 - OPEN_LINE_DISCHARGE_COEFFICIENT_UNCERTAINTY_FRACTION)) /
                OPEN_LINE_DISCHARGE_COEFFICIENT,
            10,
        );
        expect(ratios.high).toBeCloseTo(1.25, 10);
    });

    it('collapses the coefficient band to a point when the fraction is set to zero', () => {
        const result = evaluateOpenLine(refugeBay, {
            ...withTariff,
            openLineDischargeCoefficientUncertaintyFraction: 0,
        });
        const flow = result.massFlowKgPerS as Range;

        expect(flow.low).toBe(flow.expected);
        expect(flow.high).toBe(flow.expected);
    });

    it('takes a discharge coefficient override over the catalogue default', () => {
        const overridden = evaluateOpenLine({ ...refugeBay, dischargeCoefficient: 1 }, withTariff);
        const nominal = evaluateOpenLine(refugeBay, withTariff);

        expect(
            (overridden.massFlowKgPerS?.expected as number) /
                (nominal.massFlowKgPerS?.expected as number),
        ).toBeCloseTo(1 / OPEN_LINE_DISCHARGE_COEFFICIENT, 9);
    });

    it('cannot give a cost with no tariff set, and says so rather than saying zero', () => {
        const result = evaluateOpenLine(refugeBay, DEFAULT_CALC_SETTINGS);

        expect(result.annualCostZar).toBeNull();
        expect(result.annualCostZar).not.toBe(0);
        expect(result.costUnavailableReason).toBe('no-tariff-set');
        // But the flow and energy figures are real, independent of the tariff.
        expect(result.massFlowKgPerS).not.toBeNull();
        expect(result.annualEnergyKwh).not.toBeNull();
    });

    it('costs once a tariff is set, and the cost band is never a single number', () => {
        const result = evaluateOpenLine(refugeBay, withTariff);
        const cost = result.annualCostZar as Range;

        expect(cost.low).toBeLessThan(cost.expected);
        expect(cost.high).toBeGreaterThan(cost.expected);
    });

    it('costs far more than a small leak — a wide-open branch moves far more air', () => {
        const openLine = evaluateOpenLine(refugeBay, withTariff);
        // Reuse the hand-check leak's numbers indirectly via a rough magnitude
        // check rather than importing evaluateLeak, to keep this file testing
        // one function.
        expect((openLine.annualCostZar as Range).expected).toBeGreaterThan(100_000);
    });

    it('reports the condition instead of a wrong answer when the line is not choked', () => {
        const result = evaluateOpenLine(refugeBay, { ...withTariff, linePressureKpaG: 50 });

        expect(result.choked).toBe(false);
        expect(result.flowUnavailableReason).toBe('not-choked');
        expect(result.massFlowKgPerS).toBeNull();
        expect(result.annualCostZar).toBeNull();
        // The bore is still reported — it was known, unlike a leak's diameter.
        expect(result.equivalentDiameterMm).toEqual({ low: 25, expected: 25, high: 25 });
    });

    it('does not mutate the settings or input it was given', () => {
        const settings: CalcSettings = { ...withTariff };
        const input: OpenLineInput = { ...refugeBay };
        const beforeSettings = JSON.stringify(settings);
        const beforeInput = JSON.stringify(input);

        evaluateOpenLine(input, settings);

        expect(JSON.stringify(settings)).toBe(beforeSettings);
        expect(JSON.stringify(input)).toBe(beforeInput);
    });

    it('returns the same answer every time for the same inputs', () => {
        expect(evaluateOpenLine(refugeBay, withTariff)).toEqual(
            evaluateOpenLine(refugeBay, withTariff),
        );
    });
});
