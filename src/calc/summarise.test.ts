import { describe, expect, it } from 'vitest';

import { DEFAULT_CALC_SETTINGS } from './constants.ts';
import { summariseLeaks, type LoggedLeak } from './summarise.ts';
import type { CalcSettings, Range, TariffSchedule } from './types.ts';

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
    source: 'Fictional schedule, summarise.test.ts fixture',
};

const withTariff: CalcSettings = { ...DEFAULT_CALC_SETTINGS, tariff: TEST_TARIFF };

const smallCoupling: LoggedLeak = {
    id: 'leak-1',
    leakTypeId: 'failed-hose-coupling',
    equivalentDiameterMm: 3,
    diameterProvenance: 'catalogue',
    linePressureKpaG: 500,
};

// 6 mm is not failed-hose-coupling's 3 mm catalogue default — a measured
// override, same as a crew reporting a bigger-than-typical failure.
const bigCoupling: LoggedLeak = {
    id: 'leak-2',
    leakTypeId: 'failed-hose-coupling',
    equivalentDiameterMm: 6,
    diameterProvenance: 'measured',
    linePressureKpaG: 500,
};

const pinhole: LoggedLeak = {
    id: 'leak-3',
    leakTypeId: 'pinhole-in-hose',
    equivalentDiameterMm: 1,
    diameterProvenance: 'catalogue',
    linePressureKpaG: 500,
};

const refugeBay: LoggedLeak = {
    id: 'open-1',
    leakTypeId: 'refuge-bay-self-ventilation',
    equivalentDiameterMm: 25, // a real bore, not an orifice equivalent
    diameterProvenance: 'measured', // open lines have no catalogue default to fall back to
    linePressureKpaG: 500,
};

describe('summariseLeaks', () => {
    it('dispatches leaks to the leak list and open lines to their own list, never mixed', () => {
        const summary = summariseLeaks([smallCoupling, refugeBay], withTariff);

        expect(summary.leaks.map((row) => row.id)).toEqual(['leak-1']);
        expect(summary.openLines.map((row) => row.id)).toEqual(['open-1']);
    });

    it('never runs an open line through the leak diameter-inference model', () => {
        // If it had been, an open line with a 25mm "equivalent diameter" would
        // carry a +-30% band, not a point value.
        const summary = summariseLeaks([refugeBay], withTariff);

        expect(summary.openLines[0].result.equivalentDiameterMm).toEqual({
            low: 25,
            expected: 25,
            high: 25,
        });
    });

    it('sorts the leak list by expected annual cost, descending', () => {
        const summary = summariseLeaks([smallCoupling, bigCoupling, pinhole], withTariff);

        expect(summary.leaks.map((row) => row.id)).toEqual(['leak-2', 'leak-1', 'leak-3']);
    });

    it('falls back to ranking by energy when no tariff is set', () => {
        const summary = summariseLeaks([smallCoupling, bigCoupling, pinhole], DEFAULT_CALC_SETTINGS);

        expect(summary.leaks.map((row) => row.id)).toEqual(['leak-2', 'leak-1', 'leak-3']);
        expect(summary.leaks[0].result.annualCostZar).toBeNull();
    });

    it('totals the leak category and the open-line category separately, with no combined field', () => {
        const summary = summariseLeaks([smallCoupling, bigCoupling, refugeBay], withTariff);

        expect(summary.leakTotals.count).toBe(2);
        expect(summary.openLineTotals.count).toBe(1);
        expect(Object.keys(summary)).not.toContain('totalCostZar');
        expect(Object.keys(summary)).not.toContain('combinedTotal');
    });

    it('sums the leak total from exactly its own members, independent of open lines', () => {
        const leaksOnly = summariseLeaks([smallCoupling, bigCoupling], withTariff);
        const withOpenLine = summariseLeaks([smallCoupling, bigCoupling, refugeBay], withTariff);

        expect((withOpenLine.leakTotals.annualCostZar as Range).expected).toBeCloseTo(
            (leaksOnly.leakTotals.annualCostZar as Range).expected,
            6,
        );
    });

    it('gives a real zero-band total for a category with no records, not a null', () => {
        const summary = summariseLeaks([smallCoupling], withTariff);

        expect(summary.openLineTotals.count).toBe(0);
        expect(summary.openLineTotals.annualCostZar).toEqual({ low: 0, expected: 0, high: 0 });
    });

    it('reports the total cost as null with a reason, not zero, when no tariff is set', () => {
        const summary = summariseLeaks([smallCoupling, refugeBay], DEFAULT_CALC_SETTINGS);

        expect(summary.leakTotals.annualCostZar).toBeNull();
        expect(summary.leakTotals.annualCostZar).not.toEqual({ low: 0, expected: 0, high: 0 });
        expect(summary.leakTotals.costUnavailableReason).toBe('no-tariff-set');
        expect(summary.openLineTotals.costUnavailableReason).toBe('no-tariff-set');
    });

    it('groups loss by leak type, leaks only — never an open line, even when both are logged', () => {
        const summary = summariseLeaks([smallCoupling, bigCoupling, pinhole, refugeBay], withTariff);

        const types = summary.byLeakType.map((row) => row.leakTypeId).sort();
        expect(types).toEqual(['failed-hose-coupling', 'pinhole-in-hose'].sort());
        expect(summary.byLeakType.every((row) => row.category === 'leak')).toBe(true);

        const coupling = summary.byLeakType.find((row) => row.leakTypeId === 'failed-hose-coupling');
        expect(coupling?.count).toBe(2);
    });

    it('groups loss by open-line type in its own breakdown, kept off the leak chart', () => {
        const summary = summariseLeaks([smallCoupling, bigCoupling, pinhole, refugeBay], withTariff);

        const types = summary.byOpenLineType.map((row) => row.leakTypeId);
        expect(types).toEqual(['refuge-bay-self-ventilation']);
        expect(summary.byOpenLineType[0].category).toBe('deliberate-open-line');
        expect(summary.byLeakType.map((row) => row.leakTypeId)).not.toContain(
            'refuge-bay-self-ventilation',
        );
    });

    it("passes a record's diameter provenance through to the evaluated result, for a catalogue default and a measured override alike", () => {
        const summary = summariseLeaks([smallCoupling, bigCoupling], withTariff);

        const small = summary.leaks.find((row) => row.id === 'leak-1');
        const big = summary.leaks.find((row) => row.id === 'leak-2');

        expect(small?.result.diameterProvenance).toBe('catalogue');
        expect(big?.result.diameterProvenance).toBe('measured');
    });

    it('returns an empty, well-formed summary for no records at all', () => {
        const summary = summariseLeaks([], withTariff);

        expect(summary.leaks).toEqual([]);
        expect(summary.openLines).toEqual([]);
        expect(summary.byLeakType).toEqual([]);
        expect(summary.byOpenLineType).toEqual([]);
        expect(summary.leakTotals.count).toBe(0);
    });
});
