import { describe, expect, it } from 'vitest';

import { DEFAULT_CALC_SETTINGS, HOURS_PER_YEAR } from './constants.ts';
import { evaluateLeak } from './index.ts';
import type { CalcSettings, LeakInput, Range, TariffSchedule } from './types.ts';

/**
 * The same fictional schedule used in cost.test.ts. Invented for the tests and
 * never to be copied into the application; the shipped default is null.
 *
 * One kilowatt running all year on this schedule costs R13 576.24.
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
    source: 'Fictional schedule, index.test.ts fixture',
};

const COST_PER_KW_YEAR = 13576.24;

/** Site compressor performance, kW per m3/s free air. A test fixture. */
const SITE_SPECIFIC_POWER = 350;

const withTariff: CalcSettings = {
    ...DEFAULT_CALC_SETTINGS,
    tariff: TEST_TARIFF,
};

const withSiteData: CalcSettings = {
    ...DEFAULT_CALC_SETTINGS,
    compressor: {
        ...DEFAULT_CALC_SETTINGS.compressor,
        specificPowerKwPerM3PerSec: SITE_SPECIFIC_POWER,
        source: 'Compressor house performance test, March 2026',
    },
};

/** A failed 3 mm hose coupling. The hand-check case. */
const handCheckLeak: LeakInput = { leakTypeId: 'failed-hose-coupling' };

/** Helper: the low and high multiples of a band's expected value. */
function bandRatios(range: Range): { low: number; high: number } {
    return {
        low: range.low / range.expected,
        high: range.high / range.expected,
    };
}

describe('the hand-check leak, end to end', () => {
    const result = evaluateLeak(handCheckLeak, DEFAULT_CALC_SETTINGS);

    it('keeps the leak in the leak category', () => {
        expect(result.leakTypeId).toBe('failed-hose-coupling');
        expect(result.category).toBe('leak');
    });

    it('bands the diameter at plus or minus 30 percent of 3 mm', () => {
        expect(result.equivalentDiameterMm?.low).toBeCloseTo(2.1, 10);
        expect(result.equivalentDiameterMm?.expected).toBe(3);
        expect(result.equivalentDiameterMm?.high).toBeCloseTo(3.9, 10);
    });

    it('confirms the flow is choked and says at what ratio', () => {
        expect(result.choked).toBe(true);
        // 101 325 / 601 325, well under the critical 0.528
        expect(result.pressureRatio).toBeCloseTo(0.168503, 6);
        expect(result.flowUnavailableReason).toBeNull();
    });

    it('gives 6.12 g/s at the expected diameter', () => {
        expect(result.massFlowKgPerS?.expected).toBeCloseTo(0.006118, 6);
    });

    it('gives 5.08 litres per second of free air', () => {
        expect(result.freeAirDeliveryLPerS?.expected).toBeCloseTo(5.08, 2);
    });

    it('gives 1.375 kW by the theoretical method, which it prefers with no site data', () => {
        expect(result.power.theoretical.powerKw?.expected).toBeCloseTo(1.3748, 3);
        expect(result.power.theoretical.preferred).toBe(true);
        expect(result.power.theoretical.basis).toContain('eta = 0.75 assumed');
    });

    it('has no empirical figure, and says why', () => {
        expect(result.power.empirical.powerKw).toBeNull();
        expect(result.power.empirical.preferred).toBe(false);
        expect(result.power.empirical.basis).toMatch(/no site .*specific power/i);
    });

    it('gives 12 043 kWh a year', () => {
        expect(result.annualEnergyKwh?.expected).toBeCloseTo(12042.85, 1);
    });

    it('cannot give a cost, and says that rather than saying zero', () => {
        expect(result.annualCostZar).toBeNull();
        expect(result.annualCostZar).not.toBe(0);
        expect(result.costUnavailableReason).toBe('no-tariff-set');
    });

    it('is not waiting on any input from the user', () => {
        expect(result.unresolvedInputs).toEqual([]);
    });
});

describe('the band survives the whole chain', () => {
    const result = evaluateLeak(handCheckLeak, withTariff);

    it('squares the diameter band into the flow band', () => {
        const ratios = bandRatios(result.massFlowKgPerS as Range);

        expect(ratios.low).toBeCloseTo(0.49, 9);
        expect(ratios.high).toBeCloseTo(1.69, 9);
    });

    it('carries the same proportions through to power', () => {
        const ratios = bandRatios(result.power.theoretical.powerKw as Range);

        expect(ratios.low).toBeCloseTo(0.49, 9);
        expect(ratios.high).toBeCloseTo(1.69, 9);
    });

    it('carries the same proportions through to energy and rand', () => {
        const energy = bandRatios(result.annualEnergyKwh as Range);
        const cost = bandRatios(result.annualCostZar as Range);

        expect(energy.low).toBeCloseTo(0.49, 9);
        expect(energy.high).toBeCloseTo(1.69, 9);
        expect(cost.low).toBeCloseTo(0.49, 9);
        expect(cost.high).toBeCloseTo(1.69, 9);
    });

    it('reports a cost band, never a single number', () => {
        const cost = result.annualCostZar as Range;

        // About R9 100 to R31 500 around an expected R18 700. Reporting the
        // middle of that alone would be a claim the input cannot support.
        expect(cost.expected).toBeCloseTo(1.3747551 * COST_PER_KW_YEAR, 1);
        expect(cost.low).toBeLessThan(cost.expected);
        expect(cost.high).toBeGreaterThan(cost.expected);
    });
});

describe('deliberate open lines', () => {
    const selfVentilation: LeakInput = {
        leakTypeId: 'refuge-bay-self-ventilation',
    };

    it('stays in its own category and never becomes a leak', () => {
        const result = evaluateLeak(selfVentilation, withTariff);

        expect(result.category).toBe('deliberate-open-line');
    });

    it('asks for the bore instead of inventing one', () => {
        const result = evaluateLeak(selfVentilation, withTariff);

        expect(result.equivalentDiameterMm).toBeNull();
        expect(result.massFlowKgPerS).toBeNull();
        expect(result.annualEnergyKwh).toBeNull();
        expect(result.annualCostZar).toBeNull();
        expect(result.flowUnavailableReason).toBe('diameter-not-set');
        expect(result.unresolvedInputs).toEqual(['equivalentDiameterMm']);
    });

    it('does not blame the tariff when the tariff is fine', () => {
        const result = evaluateLeak(selfVentilation, withTariff);

        expect(result.costUnavailableReason).toBeNull();
    });

    it('costs normally once someone supplies the bore', () => {
        const result = evaluateLeak(
            { ...selfVentilation, equivalentDiameterMm: 25 },
            withTariff,
        );

        expect(result.category).toBe('deliberate-open-line');
        expect(result.unresolvedInputs).toEqual([]);
        expect(result.equivalentDiameterMm?.expected).toBe(25);
        expect(result.annualCostZar).not.toBeNull();

        // A 25 mm open line against a 3 mm coupling: 69 times the area, and
        // Cd 1.0 against 0.61. This is why they are totalled separately.
        const coupling = evaluateLeak(handCheckLeak, withTariff);
        expect(
            (result.annualCostZar as Range).expected /
                (coupling.annualCostZar as Range).expected,
        ).toBeGreaterThan(100);
    });
});

describe('when the site has compressor data', () => {
    const result = evaluateLeak(handCheckLeak, {
        ...withSiteData,
        tariff: TEST_TARIFF,
    });

    it('prefers the empirical figure', () => {
        expect(result.power.empirical.preferred).toBe(true);
        expect(result.power.theoretical.preferred).toBe(false);
    });

    it('still reports the theoretical figure alongside it', () => {
        expect(result.power.theoretical.powerKw?.expected).toBeCloseTo(1.3748, 3);
    });

    it('computes the empirical figure from free air delivered', () => {
        const fad = result.freeAirDeliveryLPerS as Range;

        expect(result.power.empirical.powerKw?.expected).toBeCloseTo(
            (fad.expected / 1000) * SITE_SPECIFIC_POWER,
            9,
        );
    });

    it('costs the preferred figure, not the theoretical one', () => {
        const empiricalKw = result.power.empirical.powerKw as Range;

        expect((result.annualCostZar as Range).expected).toBeCloseTo(
            empiricalKw.expected * COST_PER_KW_YEAR,
            6,
        );
    });

    it('never presents an average of the two methods', () => {
        expect(Object.keys(result.power).sort()).toEqual([
            'empirical',
            'theoretical',
        ]);
    });
});

describe('overrides', () => {
    it('takes a measured diameter over the catalogue default', () => {
        const result = evaluateLeak(
            { ...handCheckLeak, equivalentDiameterMm: 4.5 },
            DEFAULT_CALC_SETTINGS,
        );

        expect(result.equivalentDiameterMm?.expected).toBe(4.5);
    });

    it('keeps the same band width on a measured diameter', () => {
        // An override changes the nominal, not the confidence. A diameter
        // inferred from a detector reading is not an exact number either. A
        // genuinely gauged hole is handled by setting the fraction to 0.
        const result = evaluateLeak(
            { ...handCheckLeak, equivalentDiameterMm: 4.5 },
            DEFAULT_CALC_SETTINGS,
        );

        expect(result.equivalentDiameterMm?.low).toBeCloseTo(3.15, 10);
        expect(result.equivalentDiameterMm?.high).toBeCloseTo(5.85, 10);
    });

    it('collapses the band when the fraction is set to zero', () => {
        const result = evaluateLeak(handCheckLeak, {
            ...DEFAULT_CALC_SETTINGS,
            diameterUncertaintyFraction: 0,
        });

        const flow = result.massFlowKgPerS as Range;

        expect(flow.low).toBe(flow.expected);
        expect(flow.high).toBe(flow.expected);
    });

    it('takes a line pressure per leak over the settings default', () => {
        const lower = evaluateLeak(
            { ...handCheckLeak, linePressureKpaG: 400 },
            DEFAULT_CALC_SETTINGS,
        );
        const higher = evaluateLeak(handCheckLeak, DEFAULT_CALC_SETTINGS);

        expect(lower.massFlowKgPerS?.expected).toBeLessThan(
            higher.massFlowKgPerS?.expected as number,
        );
    });

    it('takes a discharge coefficient over the catalogue default', () => {
        const rounded = evaluateLeak(
            { ...handCheckLeak, dischargeCoefficient: 1 },
            DEFAULT_CALC_SETTINGS,
        );
        const sharp = evaluateLeak(handCheckLeak, DEFAULT_CALC_SETTINGS);

        expect(
            (rounded.massFlowKgPerS?.expected as number) /
                (sharp.massFlowKgPerS?.expected as number),
        ).toBeCloseTo(1 / 0.61, 9);
    });

    it('takes an air temperature over the settings default', () => {
        const hot = evaluateLeak(
            { ...handCheckLeak, airTemperatureC: 40 },
            DEFAULT_CALC_SETTINGS,
        );
        const cool = evaluateLeak(handCheckLeak, DEFAULT_CALC_SETTINGS);

        // Hotter air is less dense, so less mass escapes through the same hole.
        expect(hot.massFlowKgPerS?.expected).toBeLessThan(
            cool.massFlowKgPerS?.expected as number,
        );
    });
});

describe('a line that is not choked', () => {
    const lowPressure: CalcSettings = {
        ...DEFAULT_CALC_SETTINGS,
        linePressureKpaG: 50,
    };

    it('reports the condition instead of throwing at the register', () => {
        const result = evaluateLeak(handCheckLeak, lowPressure);

        expect(result.choked).toBe(false);
        expect(result.flowUnavailableReason).toBe('not-choked');
    });

    it('returns no figures rather than wrong ones', () => {
        const result = evaluateLeak(handCheckLeak, lowPressure);

        expect(result.massFlowKgPerS).toBeNull();
        expect(result.power.theoretical.powerKw).toBeNull();
        expect(result.annualEnergyKwh).toBeNull();
        expect(result.annualCostZar).toBeNull();
    });

    it('still reports the pressure ratio, so the reason is visible', () => {
        const result = evaluateLeak(handCheckLeak, lowPressure);

        expect(result.pressureRatio).toBeCloseTo(0.6696, 4);
    });
});

describe('an unknown leak type', () => {
    it('throws, because that is a wiring fault and not a field one', () => {
        expect(() =>
            evaluateLeak({ leakTypeId: 'ruptured-manifold' }, DEFAULT_CALC_SETTINGS),
        ).toThrow(/ruptured-manifold/);
    });

    it('names the ids that would have worked', () => {
        expect(() =>
            evaluateLeak({ leakTypeId: 'ruptured-manifold' }, DEFAULT_CALC_SETTINGS),
        ).toThrow(/failed-hose-coupling/);
    });
});

describe('purity', () => {
    it('returns the same answer every time for the same inputs', () => {
        const first = evaluateLeak(handCheckLeak, withTariff);
        const second = evaluateLeak(handCheckLeak, withTariff);

        expect(first).toEqual(second);
    });

    it('does not mutate the settings it was given', () => {
        const settings: CalcSettings = { ...DEFAULT_CALC_SETTINGS };
        const before = JSON.stringify(settings);

        evaluateLeak(handCheckLeak, settings);

        expect(JSON.stringify(settings)).toBe(before);
    });

    it('does not mutate the input it was given', () => {
        const input: LeakInput = { ...handCheckLeak };
        const before = JSON.stringify(input);

        evaluateLeak(input, DEFAULT_CALC_SETTINGS);

        expect(JSON.stringify(input)).toBe(before);
    });

    it('costs a leak over the operating hours it was given', () => {
        const halfYear = evaluateLeak(handCheckLeak, {
            ...withTariff,
            operatingHoursPerYear: HOURS_PER_YEAR / 2,
        });
        const fullYear = evaluateLeak(handCheckLeak, withTariff);

        expect((halfYear.annualEnergyKwh as Range).expected).toBeCloseTo(
            (fullYear.annualEnergyKwh as Range).expected / 2,
            6,
        );
    });
});
