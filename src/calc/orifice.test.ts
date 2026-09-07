import { describe, expect, it } from 'vitest';

import {
    ATMOSPHERIC_PRESSURE_PA,
    CRITICAL_PRESSURE_RATIO_AIR,
    DISCHARGE_COEFFICIENTS,
} from './constants.ts';
import {
    chokedMassFlowKgPerS,
    isChoked,
    NotChokedError,
    orificeAreaM2,
} from './orifice.ts';

/**
 * The hand-check case, worked in HANDCHECK.md: a failed 3 mm hose coupling on a
 * 500 kPa gauge line at 20 degrees C, sharp-edged so Cd = 0.61.
 */
const HAND_CHECK = {
    orificeDiameterMm: 3,
    dischargeCoefficient: DISCHARGE_COEFFICIENTS.sharpEdged,
    upstreamAbsolutePressurePa: 500_000 + ATMOSPHERIC_PRESSURE_PA, // 601 325 Pa
    upstreamTemperatureK: 293.15,
    downstreamAbsolutePressurePa: ATMOSPHERIC_PRESSURE_PA,
};

describe('orifice area', () => {
    it('converts a 3 mm diameter to square metres', () => {
        // pi/4 * 0.003^2
        expect(orificeAreaM2(3)).toBeCloseTo(7.0685835e-6, 12);
    });

    it('goes with the square of diameter', () => {
        expect(orificeAreaM2(6) / orificeAreaM2(3)).toBeCloseTo(4, 10);
    });

    it('refuses a diameter that is not a positive number', () => {
        expect(() => orificeAreaM2(0)).toThrow(RangeError);
        expect(() => orificeAreaM2(-3)).toThrow(RangeError);
        expect(() => orificeAreaM2(Number.NaN)).toThrow(RangeError);
    });
});

describe('critical pressure ratio check', () => {
    it('treats a mine reticulation line venting to atmosphere as choked', () => {
        // 101 325 / 601 325 = 0.168, well under 0.528
        expect(
            isChoked(ATMOSPHERIC_PRESSURE_PA, 500_000 + ATMOSPHERIC_PRESSURE_PA),
        ).toBe(true);
    });

    it('is choked across the whole 400-500 kPa gauge band of spec section 3.1', () => {
        for (const gaugeKpa of [400, 450, 500]) {
            expect(
                isChoked(
                    ATMOSPHERIC_PRESSURE_PA,
                    gaugeKpa * 1000 + ATMOSPHERIC_PRESSURE_PA,
                ),
            ).toBe(true);
        }
    });

    it('is not choked on a low-pressure line', () => {
        // 65 kPa gauge: 101 325 / 166 325 = 0.609, above the critical value
        expect(
            isChoked(ATMOSPHERIC_PRESSURE_PA, 65_000 + ATMOSPHERIC_PRESSURE_PA),
        ).toBe(false);
    });

    it('counts the critical ratio itself as choked', () => {
        const upstream = ATMOSPHERIC_PRESSURE_PA / CRITICAL_PRESSURE_RATIO_AIR;

        expect(isChoked(ATMOSPHERIC_PRESSURE_PA, upstream)).toBe(true);
    });
});

describe('choked mass flow', () => {
    it('matches the hand-check: 3 mm coupling at 500 kPa gauge gives 6.12 g/s', () => {
        const result = chokedMassFlowKgPerS(HAND_CHECK);

        expect(result.massFlowKgPerS).toBeCloseTo(0.006118, 6);
        expect(result.orificeAreaM2).toBeCloseTo(7.0685835e-6, 12);
        expect(result.choked).toBe(true);
        expect(result.pressureRatio).toBeCloseTo(0.1685, 4);
    });

    it('goes with the square of diameter, which is why the bands are wide', () => {
        const small = chokedMassFlowKgPerS(HAND_CHECK);
        const large = chokedMassFlowKgPerS({
            ...HAND_CHECK,
            orificeDiameterMm: 6,
        });

        expect(large.massFlowKgPerS / small.massFlowKgPerS).toBeCloseTo(4, 10);
    });

    it('is linear in upstream absolute pressure', () => {
        const single = chokedMassFlowKgPerS(HAND_CHECK);
        const doubled = chokedMassFlowKgPerS({
            ...HAND_CHECK,
            upstreamAbsolutePressurePa:
                HAND_CHECK.upstreamAbsolutePressurePa * 2,
        });

        expect(doubled.massFlowKgPerS / single.massFlowKgPerS).toBeCloseTo(2, 10);
    });

    it('takes the discharge coefficient as an input rather than assuming one', () => {
        const sharp = chokedMassFlowKgPerS(HAND_CHECK);
        const open = chokedMassFlowKgPerS({
            ...HAND_CHECK,
            dischargeCoefficient: DISCHARGE_COEFFICIENTS.fullyOpen,
        });

        expect(open.massFlowKgPerS / sharp.massFlowKgPerS).toBeCloseTo(
            1 / DISCHARGE_COEFFICIENTS.sharpEdged,
            10,
        );
    });

    it('does not depend on downstream pressure while the flow is choked', () => {
        // The defining property of choked flow: the throat is sonic, so nothing
        // downstream can signal back upstream. A leak venting into a partly
        // pressurised space flows exactly as fast as one venting to atmosphere,
        // provided both stay under the critical ratio.
        const toAtmosphere = chokedMassFlowKgPerS(HAND_CHECK);
        const intoBackPressure = chokedMassFlowKgPerS({
            ...HAND_CHECK,
            downstreamAbsolutePressurePa: 150_000,
        });

        expect(intoBackPressure.massFlowKgPerS).toBe(
            toAtmosphere.massFlowKgPerS,
        );
        expect(intoBackPressure.pressureRatio).not.toBe(
            toAtmosphere.pressureRatio,
        );
    });

    it('falls with the square root of upstream temperature', () => {
        const cool = chokedMassFlowKgPerS(HAND_CHECK);
        const hot = chokedMassFlowKgPerS({
            ...HAND_CHECK,
            upstreamTemperatureK: HAND_CHECK.upstreamTemperatureK * 4,
        });

        expect(hot.massFlowKgPerS / cool.massFlowKgPerS).toBeCloseTo(0.5, 10);
    });
});

describe('behaviour when the flow is not choked', () => {
    const lowPressure = {
        ...HAND_CHECK,
        upstreamAbsolutePressurePa: 65_000 + ATMOSPHERIC_PRESSURE_PA,
    };

    it('throws rather than returning a wrong answer', () => {
        expect(() => chokedMassFlowKgPerS(lowPressure)).toThrow(NotChokedError);
    });

    it('states the boundary of the model in the message', () => {
        expect(() => chokedMassFlowKgPerS(lowPressure)).toThrow(
            /Pressure ratio 0\.609 exceeds the critical value of 0\.528; flow is not choked\./,
        );
        expect(() => chokedMassFlowKgPerS(lowPressure)).toThrow(
            /This tool models choked flow only\./,
        );
    });

    it('carries the two ratios on the error, for a caller that wants to react', () => {
        try {
            chokedMassFlowKgPerS(lowPressure);
            expect.unreachable('expected a NotChokedError');
        } catch (error) {
            expect(error).toBeInstanceOf(NotChokedError);
            const notChoked = error as NotChokedError;
            expect(notChoked.pressureRatio).toBeCloseTo(0.609, 3);
            expect(notChoked.criticalPressureRatio).toBe(
                CRITICAL_PRESSURE_RATIO_AIR,
            );
        }
    });
});

describe('input guards', () => {
    it('refuses a non-positive absolute pressure', () => {
        expect(() =>
            chokedMassFlowKgPerS({
                ...HAND_CHECK,
                upstreamAbsolutePressurePa: 0,
            }),
        ).toThrow(RangeError);
    });

    it('refuses a non-positive absolute temperature', () => {
        expect(() =>
            chokedMassFlowKgPerS({ ...HAND_CHECK, upstreamTemperatureK: 0 }),
        ).toThrow(RangeError);
    });

    it('refuses a discharge coefficient outside nought to one', () => {
        expect(() =>
            chokedMassFlowKgPerS({ ...HAND_CHECK, dischargeCoefficient: 0 }),
        ).toThrow(RangeError);
        expect(() =>
            chokedMassFlowKgPerS({ ...HAND_CHECK, dischargeCoefficient: 1.4 }),
        ).toThrow(RangeError);
    });
});
