import { describe, expect, it } from 'vitest';

import {
    ATMOSPHERIC_PRESSURE_PA,
    DEFAULT_COMPRESSOR_SPEC,
    FREE_AIR_REFERENCE_PRESSURE_PA,
} from './constants.ts';
import {
    compressorPower,
    empiricalPowerKw,
    freeAirDeliveryM3PerS,
    theoreticalPolytropicPowerKw,
} from './compressor.ts';
import type { CompressorSpec } from './types.ts';

/**
 * Mass flow of the hand-check leak, from orifice.ts: a 3 mm coupling at
 * 500 kPa gauge, 20 degrees C, Cd 0.61.
 */
const HAND_CHECK_MASS_FLOW_KG_PER_S = 0.006118;

const baseInput = {
    massFlowKgPerS: HAND_CHECK_MASS_FLOW_KG_PER_S,
    spec: DEFAULT_COMPRESSOR_SPEC,
    atmosphericPressurePa: ATMOSPHERIC_PRESSURE_PA,
};

/**
 * A stand-in for site compressor performance data. This figure is a test
 * fixture and nothing more — the real one comes off the mine's own compressor
 * curves, which is why the default in constants.ts is null.
 */
const SITE_SPECIFIC_POWER_KW_PER_M3_PER_S = 350;

const withSiteData: CompressorSpec = {
    ...DEFAULT_COMPRESSOR_SPEC,
    specificPowerKwPerM3PerSec: SITE_SPECIFIC_POWER_KW_PER_M3_PER_S,
    source: 'Compressor house performance test, March 2026',
};

describe('free air delivery', () => {
    it('converts the hand-check mass flow to about 5.08 litres per second', () => {
        // 0.006118 kg/s over a reference density of 1.2043 kg/m3
        expect(freeAirDeliveryM3PerS(HAND_CHECK_MASS_FLOW_KG_PER_S)).toBeCloseTo(
            0.005080,
            6,
        );
    });

    it('uses the stated reference conditions, not the conditions in the line', () => {
        // Free air delivery is quoted at intake conditions by definition, which
        // is what makes a specific power figure comparable between machines.
        expect(FREE_AIR_REFERENCE_PRESSURE_PA).toBe(101325);
    });

    it('is linear in mass flow', () => {
        expect(freeAirDeliveryM3PerS(2) / freeAirDeliveryM3PerS(1)).toBeCloseTo(
            2,
            10,
        );
    });
});

describe('theoretical polytropic power', () => {
    it('matches the hand-check: 1.375 kW for a 3 mm coupling at 500 kPa gauge', () => {
        const powerKw = theoreticalPolytropicPowerKw(baseInput);

        expect(powerKw).toBeCloseTo(1.375, 2);
    });

    it('is linear in mass flow', () => {
        const single = theoreticalPolytropicPowerKw(baseInput);
        const doubled = theoreticalPolytropicPowerKw({
            ...baseInput,
            massFlowKgPerS: HAND_CHECK_MASS_FLOW_KG_PER_S * 2,
        });

        expect(doubled / single).toBeCloseTo(2, 10);
    });

    it('goes inversely with isentropic efficiency, which is the point of exposing it', () => {
        const at75 = theoreticalPolytropicPowerKw(baseInput);
        const at70 = theoreticalPolytropicPowerKw({
            ...baseInput,
            spec: { ...DEFAULT_COMPRESSOR_SPEC, isentropicEfficiency: 0.7 },
        });

        expect(at70).toBeGreaterThan(at75);
        expect(at70 / at75).toBeCloseTo(0.75 / 0.7, 10);
    });

    it('falls as stages are added, which is what intercooling buys', () => {
        const powerFor = (stageCount: number) =>
            theoreticalPolytropicPowerKw({
                ...baseInput,
                spec: { ...DEFAULT_COMPRESSOR_SPEC, stageCount },
            });

        expect(powerFor(1)).toBeGreaterThan(powerFor(2));
        expect(powerFor(2)).toBeGreaterThan(powerFor(3));
    });

    it('rises with discharge pressure', () => {
        const at500 = theoreticalPolytropicPowerKw(baseInput);
        const at600 = theoreticalPolytropicPowerKw({
            ...baseInput,
            spec: {
                ...DEFAULT_COMPRESSOR_SPEC,
                dischargePressureKpaG: 600,
            },
        });

        expect(at600).toBeGreaterThan(at500);
    });

    it('refuses a polytropic exponent of one, where the equation is undefined', () => {
        expect(() =>
            theoreticalPolytropicPowerKw({
                ...baseInput,
                spec: { ...DEFAULT_COMPRESSOR_SPEC, polytropicExponent: 1 },
            }),
        ).toThrow(RangeError);
    });

    it('refuses an efficiency outside nought to one', () => {
        expect(() =>
            theoreticalPolytropicPowerKw({
                ...baseInput,
                spec: { ...DEFAULT_COMPRESSOR_SPEC, isentropicEfficiency: 1.2 },
            }),
        ).toThrow(RangeError);
    });

    it('refuses a discharge pressure at or below intake', () => {
        expect(() =>
            theoreticalPolytropicPowerKw({
                ...baseInput,
                spec: { ...DEFAULT_COMPRESSOR_SPEC, dischargePressureKpaG: 0 },
            }),
        ).toThrow(RangeError);
    });

    it('refuses a fractional stage count', () => {
        expect(() =>
            theoreticalPolytropicPowerKw({
                ...baseInput,
                spec: { ...DEFAULT_COMPRESSOR_SPEC, stageCount: 1.5 },
            }),
        ).toThrow(RangeError);
    });
});

describe('empirical specific power', () => {
    it('multiplies free air delivered by the site figure', () => {
        const fad = freeAirDeliveryM3PerS(HAND_CHECK_MASS_FLOW_KG_PER_S);

        expect(
            empiricalPowerKw(fad, SITE_SPECIFIC_POWER_KW_PER_M3_PER_S),
        ).toBeCloseTo(fad * SITE_SPECIFIC_POWER_KW_PER_M3_PER_S, 10);
    });

    it('returns null, not zero, when no site figure has been entered', () => {
        const fad = freeAirDeliveryM3PerS(HAND_CHECK_MASS_FLOW_KG_PER_S);

        expect(empiricalPowerKw(fad, null)).toBeNull();
        expect(empiricalPowerKw(fad, null)).not.toBe(0);
    });
});

describe('both methods, side by side', () => {
    it('returns exactly two named methods and nothing combined', () => {
        const result = compressorPower(baseInput);

        // No average, no blended figure, nowhere to put one.
        expect(Object.keys(result).sort()).toEqual(['empirical', 'theoretical']);
    });

    it('labels each method', () => {
        const result = compressorPower(baseInput);

        expect(result.theoretical.method).toBe('theoretical-polytropic');
        expect(result.empirical.method).toBe('empirical-specific-power');
    });

    it('prefers the theoretical method when there is no site data', () => {
        const result = compressorPower(baseInput);

        expect(result.theoretical.preferred).toBe(true);
        expect(result.theoretical.powerKw).toBeCloseTo(1.375, 2);

        expect(result.empirical.preferred).toBe(false);
        expect(result.empirical.powerKw).toBeNull();
    });

    it('prefers the empirical method the moment site data exists', () => {
        const result = compressorPower({ ...baseInput, spec: withSiteData });

        expect(result.empirical.preferred).toBe(true);
        expect(result.empirical.powerKw).not.toBeNull();

        // The theoretical figure is still returned. It is not deleted for
        // disagreeing with the measurement.
        expect(result.theoretical.preferred).toBe(false);
        expect(result.theoretical.powerKw).toBeCloseTo(1.375, 2);
    });

    it('never prefers both methods at once', () => {
        for (const spec of [DEFAULT_COMPRESSOR_SPEC, withSiteData]) {
            const result = compressorPower({ ...baseInput, spec });
            const preferredCount = [
                result.theoretical.preferred,
                result.empirical.preferred,
            ].filter(Boolean).length;

            expect(preferredCount).toBe(1);
        }
    });
});

describe('the basis string, which is what appears on screen', () => {
    it('states the assumed efficiency on the theoretical figure', () => {
        const result = compressorPower(baseInput);

        expect(result.theoretical.basis).toContain('eta = 0.75 assumed');
        expect(result.theoretical.basis).toContain('n = 1.35');
        expect(result.theoretical.basis).toContain('2 stages');
    });

    it('tracks the efficiency the user actually set', () => {
        const result = compressorPower({
            ...baseInput,
            spec: { ...DEFAULT_COMPRESSOR_SPEC, isentropicEfficiency: 0.7 },
        });

        expect(result.theoretical.basis).toContain('eta = 0.7 assumed');
        expect(result.theoretical.basis).not.toContain('0.75');
    });

    it('says where the site figure came from', () => {
        const result = compressorPower({ ...baseInput, spec: withSiteData });

        expect(result.empirical.basis).toContain('350');
        expect(result.empirical.basis).toContain(
            'Compressor house performance test, March 2026',
        );
    });

    it('says plainly that nothing has been entered when nothing has', () => {
        const result = compressorPower(baseInput);

        expect(result.empirical.basis).toMatch(/no site .*specific power/i);
    });
});
