import { describe, expect, it } from 'vitest';

import { HOURS_PER_YEAR } from './constants.ts';
import { annualCostZar, annualEnergyKwh, totalTariffHours } from './cost.ts';
import type { TariffSchedule } from './types.ts';

/**
 * A test fixture, not a tariff. The numbers are shaped like a South African
 * time-of-use schedule — a short high-demand winter season, a long low-demand
 * season, and a peak rate several times the off-peak one — but they are
 * invented for this test and must never be copied into the application. The
 * real schedule is entered by the user; `constants.ts` ships null.
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
    source: 'Fictional schedule, cost.test.ts fixture',
};

/**
 * Cost of one kilowatt running every hour of the year on the fixture above,
 * summed by hand:
 *
 *   high peak      400 h x R6.00  =  R2 400.00
 *   high standard  800 h x R1.90  =  R1 520.00
 *   high off-peak 1008 h x R1.05  =  R1 058.40
 *   low peak      1100 h x R2.10  =  R2 310.00
 *   low standard  2400 h x R1.45  =  R3 480.00
 *   low off-peak  3052 h x R0.92  =  R2 807.84
 *                                    ----------
 *                                    R13 576.24
 */
const COST_PER_KW_YEAR = 13576.24;

describe('annual energy', () => {
    it('multiplies power by the hours the leak is pressurised', () => {
        expect(annualEnergyKwh(1, HOURS_PER_YEAR)).toBe(8760);
        expect(annualEnergyKwh(1.3748, HOURS_PER_YEAR)).toBeCloseTo(12043.2, 1);
    });

    it('refuses negative power or negative hours', () => {
        expect(() => annualEnergyKwh(-1, HOURS_PER_YEAR)).toThrow(RangeError);
        expect(() => annualEnergyKwh(1, -10)).toThrow(RangeError);
    });

    it('refuses more hours than there are in a year', () => {
        expect(() => annualEnergyKwh(1, HOURS_PER_YEAR + 1)).toThrow(RangeError);
    });
});

describe('tariff hours', () => {
    it('sums all six buckets across both seasons', () => {
        expect(totalTariffHours(TEST_TARIFF)).toBe(8760);
    });

    it('counts both seasons, not just the expensive one', () => {
        const highSeasonOnly = 400 + 800 + 1008;

        expect(totalTariffHours(TEST_TARIFF)).toBeGreaterThan(highSeasonOnly);
    });
});

describe('no tariff', () => {
    it('returns null, not zero', () => {
        const cost = annualCostZar({
            powerKw: 1.3748,
            tariff: null,
            operatingHoursPerYear: HOURS_PER_YEAR,
        });

        expect(cost).toBeNull();
        // R0 per year would read as "this leak is free". It is not free; the
        // rate is unknown, and those are different statements.
        expect(cost).not.toBe(0);
    });

    it('returns null even for a leak with real power behind it', () => {
        expect(
            annualCostZar({
                powerKw: 250,
                tariff: null,
                operatingHoursPerYear: HOURS_PER_YEAR,
            }),
        ).toBeNull();
    });
});

describe('time-of-use cost', () => {
    it('costs one kilowatt for a full year at the hand-summed figure', () => {
        const cost = annualCostZar({
            powerKw: 1,
            tariff: TEST_TARIFF,
            operatingHoursPerYear: HOURS_PER_YEAR,
        });

        expect(cost).toBeCloseTo(COST_PER_KW_YEAR, 2);
    });

    it('is linear in power', () => {
        const one = annualCostZar({
            powerKw: 1,
            tariff: TEST_TARIFF,
            operatingHoursPerYear: HOURS_PER_YEAR,
        });
        const three = annualCostZar({
            powerKw: 3,
            tariff: TEST_TARIFF,
            operatingHoursPerYear: HOURS_PER_YEAR,
        });

        expect(three).toBeCloseTo((one as number) * 3, 6);
    });

    it('charges the hand-check leak about R18 660 a year', () => {
        const cost = annualCostZar({
            powerKw: 1.3748,
            tariff: TEST_TARIFF,
            operatingHoursPerYear: HOURS_PER_YEAR,
        });

        expect(cost).toBeCloseTo(COST_PER_KW_YEAR * 1.3748, 2);
        expect(cost).toBeGreaterThan(18_000);
        expect(cost).toBeLessThan(19_000);
    });

    it('responds to the peak rate, so the structure is doing work', () => {
        const dearerPeak: TariffSchedule = {
            ...TEST_TARIFF,
            ratesZarPerKwh: {
                ...TEST_TARIFF.ratesZarPerKwh,
                highDemandSeason: {
                    ...TEST_TARIFF.ratesZarPerKwh.highDemandSeason,
                    peak: 7.0,
                },
            },
        };

        const before = annualCostZar({
            powerKw: 1,
            tariff: TEST_TARIFF,
            operatingHoursPerYear: HOURS_PER_YEAR,
        });
        const after = annualCostZar({
            powerKw: 1,
            tariff: dearerPeak,
            operatingHoursPerYear: HOURS_PER_YEAR,
        });

        // One rand more across 400 high-season peak hours.
        expect((after as number) - (before as number)).toBeCloseTo(400, 6);
    });

    it('counts the low demand season, which carries most of the hours', () => {
        const highSeasonOnly: TariffSchedule = {
            ...TEST_TARIFF,
            ratesZarPerKwh: {
                ...TEST_TARIFF.ratesZarPerKwh,
                lowDemandSeason: { peak: 0, standard: 0, offPeak: 0 },
            },
        };

        const full = annualCostZar({
            powerKw: 1,
            tariff: TEST_TARIFF,
            operatingHoursPerYear: HOURS_PER_YEAR,
        });
        const winterOnly = annualCostZar({
            powerKw: 1,
            tariff: highSeasonOnly,
            operatingHoursPerYear: HOURS_PER_YEAR,
        });

        // 2400 + 1520 + 1058.40
        expect(winterOnly).toBeCloseTo(4978.4, 2);
        expect((full as number) - (winterOnly as number)).toBeCloseTo(8597.84, 2);
    });
});

describe('a leak that is not pressurised all year', () => {
    it('scales pro rata across the tariff periods', () => {
        const halfYear = annualCostZar({
            powerKw: 1,
            tariff: TEST_TARIFF,
            operatingHoursPerYear: HOURS_PER_YEAR / 2,
        });

        expect(halfYear).toBeCloseTo(COST_PER_KW_YEAR / 2, 6);
    });

    it('is an assumption, and the effective rate gives it away', () => {
        // Pro rata means the effective rate does not move with operating hours.
        // A section pressurised only during production shifts really sits in
        // peak more than pro rata implies, so this understates that leak. The
        // tool cannot know which hours a leak is live without asking a question
        // nobody can answer underground. Stated in DECISIONS.md and the README
        // rather than papered over.
        const rateFor = (hours: number) =>
            (annualCostZar({
                powerKw: 1,
                tariff: TEST_TARIFF,
                operatingHoursPerYear: hours,
            }) as number) / annualEnergyKwh(1, hours);

        expect(rateFor(HOURS_PER_YEAR)).toBeCloseTo(rateFor(2000), 10);
        expect(rateFor(HOURS_PER_YEAR)).toBeCloseTo(
            COST_PER_KW_YEAR / HOURS_PER_YEAR,
            10,
        );
    });

    it('refuses to be pressurised for more hours than the tariff covers', () => {
        expect(() =>
            annualCostZar({
                powerKw: 1,
                tariff: TEST_TARIFF,
                operatingHoursPerYear: HOURS_PER_YEAR + 100,
            }),
        ).toThrow(RangeError);
    });
});

describe('malformed schedules', () => {
    it('refuses a schedule with no hours in it at all', () => {
        const empty: TariffSchedule = {
            ...TEST_TARIFF,
            hoursPerYear: {
                highDemandSeason: { peak: 0, standard: 0, offPeak: 0 },
                lowDemandSeason: { peak: 0, standard: 0, offPeak: 0 },
            },
        };

        expect(() =>
            annualCostZar({
                powerKw: 1,
                tariff: empty,
                operatingHoursPerYear: HOURS_PER_YEAR,
            }),
        ).toThrow(RangeError);
    });

    it('refuses a schedule claiming more hours than a year has', () => {
        const overlong: TariffSchedule = {
            ...TEST_TARIFF,
            hoursPerYear: {
                highDemandSeason: { peak: 400, standard: 800, offPeak: 1008 },
                lowDemandSeason: { peak: 1100, standard: 2400, offPeak: 4000 },
            },
        };

        expect(() =>
            annualCostZar({
                powerKw: 1,
                tariff: overlong,
                operatingHoursPerYear: HOURS_PER_YEAR,
            }),
        ).toThrow(RangeError);
    });

    it('refuses a negative rate', () => {
        const negative: TariffSchedule = {
            ...TEST_TARIFF,
            ratesZarPerKwh: {
                ...TEST_TARIFF.ratesZarPerKwh,
                lowDemandSeason: { peak: 2.1, standard: -1.45, offPeak: 0.92 },
            },
        };

        expect(() =>
            annualCostZar({
                powerKw: 1,
                tariff: negative,
                operatingHoursPerYear: HOURS_PER_YEAR,
            }),
        ).toThrow(RangeError);
    });
});
