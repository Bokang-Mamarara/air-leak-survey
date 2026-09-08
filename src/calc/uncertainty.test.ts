import { describe, expect, it } from 'vitest';

import { DIAMETER_UNCERTAINTY_FRACTION } from './constants.ts';
import { coefficientBand, diameterBandMm, mapRange } from './uncertainty.ts';
import type { Range } from './types.ts';

describe('diameter band', () => {
    it('puts plus or minus 30 percent around a 3 mm coupling', () => {
        const band = diameterBandMm(3, DIAMETER_UNCERTAINTY_FRACTION);

        // Not toEqual: 3 * 0.7 is 2.0999999999999996 in binary floating point.
        // Rounding it away inside the calculation would be worse than living
        // with it, so the assertion is stated to a tolerance instead.
        expect(band.low).toBeCloseTo(2.1, 10);
        expect(band.expected).toBe(3);
        expect(band.high).toBeCloseTo(3.9, 10);
    });

    it('is symmetric on diameter, which is where the symmetry ends', () => {
        const band = diameterBandMm(3, 0.3);

        expect(band.expected - band.low).toBeCloseTo(band.high - band.expected, 10);
    });

    it('collapses to a point when the diameter was measured', () => {
        // A crew with an ultrasonic detector or a drill gauge has no band.
        expect(diameterBandMm(3, 0)).toEqual({
            low: 3,
            expected: 3,
            high: 3,
        });
    });

    it('refuses a fraction of one or more, which would allow a zero diameter', () => {
        expect(() => diameterBandMm(3, 1)).toThrow(RangeError);
        expect(() => diameterBandMm(3, 1.5)).toThrow(RangeError);
        expect(() => diameterBandMm(3, -0.1)).toThrow(RangeError);
    });

    it('refuses a diameter that is not a positive number', () => {
        expect(() => diameterBandMm(0, 0.3)).toThrow(RangeError);
        expect(() => diameterBandMm(-3, 0.3)).toThrow(RangeError);
    });
});

describe('discharge coefficient band', () => {
    it('puts plus or minus 25 percent around a nominal 0.8, spanning sharp-edged to fully open', () => {
        const band = coefficientBand(0.8, 0.25);

        expect(band.low).toBeCloseTo(0.6, 10);
        expect(band.expected).toBe(0.8);
        expect(band.high).toBeCloseTo(1.0, 10);
    });

    it('clamps the high end at 1.0, the physical ceiling for a discharge coefficient', () => {
        const band = coefficientBand(0.9, 0.3);

        // Uncapped this would be 1.17, which is not a physically meaningful
        // discharge coefficient in this model.
        expect(band.high).toBe(1);
    });

    it('collapses to a point when the fraction is zero', () => {
        expect(coefficientBand(0.8, 0)).toEqual({ low: 0.8, expected: 0.8, high: 0.8 });
    });

    it('refuses a nominal coefficient outside (0, 1]', () => {
        expect(() => coefficientBand(0, 0.25)).toThrow(RangeError);
        expect(() => coefficientBand(-0.5, 0.25)).toThrow(RangeError);
        expect(() => coefficientBand(1.5, 0.25)).toThrow(RangeError);
    });

    it('refuses a fraction of one or more, or a negative one', () => {
        expect(() => coefficientBand(0.8, 1)).toThrow(RangeError);
        expect(() => coefficientBand(0.8, -0.1)).toThrow(RangeError);
    });
});

describe('mapping a band through a step', () => {
    const band: Range = { low: 2.1, expected: 3, high: 3.9 };

    it('applies the function to each of the three members', () => {
        expect(mapRange(band, (d) => d * 2)).toEqual({
            low: 4.2,
            expected: 6,
            high: 7.8,
        });
    });

    it('leaves the input untouched', () => {
        mapRange(band, (d) => d * 2);

        expect(band).toEqual({ low: 2.1, expected: 3, high: 3.9 });
    });

    it('refuses a step that would invert the band', () => {
        // Every step from diameter through to rand per year is monotonically
        // increasing. If one is not, propagating by the endpoints is invalid
        // and this is where it gets caught rather than silently reported.
        expect(() => mapRange(band, (d) => -d)).toThrow(RangeError);
        expect(() => mapRange(band, (d) => 1 / d)).toThrow(RangeError);
    });

    it('refuses an input band that is already out of order', () => {
        const broken: Range = { low: 9, expected: 3, high: 1 };

        expect(() => mapRange(broken, (d) => d)).toThrow(RangeError);
    });

    it('refuses a step that returns something that is not a finite number', () => {
        expect(() => mapRange(band, () => Number.NaN)).toThrow(RangeError);
        expect(() => mapRange(band, () => Number.POSITIVE_INFINITY)).toThrow(
            RangeError,
        );
    });
});

describe('the square on diameter, which is the whole reason for the bands', () => {
    const area = (diameterMm: number) => diameterMm * diameterMm;

    it('turns plus or minus 30 percent on diameter into minus 51 to plus 69 percent on flow', () => {
        const flow = mapRange(diameterBandMm(3, 0.3), area);

        // 0.7^2 = 0.49 and 1.3^2 = 1.69
        expect(flow.low / flow.expected).toBeCloseTo(0.49, 10);
        expect(flow.high / flow.expected).toBeCloseTo(1.69, 10);
    });

    it('produces a band that is no longer symmetric about the expected value', () => {
        const flow = mapRange(diameterBandMm(3, 0.3), area);
        const midpoint = (flow.low + flow.high) / 2;

        // 9.81 against an expected 9. The tool must not quietly re-centre this:
        // the high side of a squared band really is further out than the low.
        expect(midpoint).not.toBeCloseTo(flow.expected, 2);
        expect(flow.high - flow.expected).toBeGreaterThan(
            flow.expected - flow.low,
        );
    });

    it('does not widen any further through the linear steps that follow', () => {
        // Flow to power to energy to rand are all proportional. Once the square
        // has been taken the band's proportions are fixed, so the cost band is
        // the same minus 51 to plus 69 percent as the flow band. That is the
        // claim the register makes, and it is asserted here rather than assumed.
        const flow = mapRange(diameterBandMm(3, 0.3), area);
        const cost = mapRange(
            mapRange(flow, (f) => f * 271), // kW per unit flow
            (kw) => kw * 8760 * 1.2, // hours by rand per kWh
        );

        expect(cost.low / cost.expected).toBeCloseTo(flow.low / flow.expected, 10);
        expect(cost.high / cost.expected).toBeCloseTo(
            flow.high / flow.expected,
            10,
        );
        expect(cost.low / cost.expected).toBeCloseTo(0.49, 10);
        expect(cost.high / cost.expected).toBeCloseTo(1.69, 10);
    });

    it('keeps a 12 mm open branch proportionally as uncertain as a 1 mm pinhole', () => {
        // A uniform fraction is a deliberate choice: there is no data to justify
        // six different bands, so the proportions are identical by construction.
        const pinhole = mapRange(diameterBandMm(1, 0.3), area);
        const branch = mapRange(diameterBandMm(12, 0.3), area);

        expect(pinhole.high / pinhole.expected).toBeCloseTo(
            branch.high / branch.expected,
            10,
        );
    });
});
