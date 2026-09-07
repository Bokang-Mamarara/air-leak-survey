import { describe, expect, it } from 'vitest';

import {
    ATMOSPHERIC_PRESSURE_PA,
    CHOKED_FLOW_COEFFICIENT,
    CRITICAL_PRESSURE_RATIO_AIR,
    DEFAULT_CALC_SETTINGS,
    DEFAULT_COMPRESSOR_SPEC,
    DIAMETER_UNCERTAINTY_FRACTION,
    DISCHARGE_COEFFICIENTS,
    FREE_AIR_REFERENCE_PRESSURE_PA,
    FREE_AIR_REFERENCE_TEMPERATURE_K,
    GAS_CONSTANT_AIR_J_PER_KG_K,
    HOURS_PER_YEAR,
    LEAK_TYPE_CATALOGUE,
    POLYTROPIC_EXPONENT_COOLED,
    REALISED_SAVING_CAVEAT,
    SPECIFIC_HEAT_RATIO_AIR,
} from './constants.ts';

/**
 * Constants are the foundation of every other module here, so they are tested
 * the way a constant can be tested: the two derived ones are recomputed from
 * their definitions, and the ones that must stay unknown are asserted to be
 * null rather than a plausible-looking number.
 */
describe('derived gas constants', () => {
    const k = SPECIFIC_HEAT_RATIO_AIR;
    const R = GAS_CONSTANT_AIR_J_PER_KG_K;

    it('recomputes the choked-flow coefficient from k and R', () => {
        // sqrt(k/R) * (2/(k+1))^((k+1)/(2(k-1)))  ->  0.040418
        const derived =
            Math.sqrt(k / R) * Math.pow(2 / (k + 1), (k + 1) / (2 * (k - 1)));

        expect(derived).toBeCloseTo(0.040418, 6);
        expect(CHOKED_FLOW_COEFFICIENT).toBeCloseTo(derived, 4);
    });

    it('recomputes the critical pressure ratio from k', () => {
        // (2/(k+1))^(k/(k-1))  ->  0.528282
        const derived = Math.pow(2 / (k + 1), k / (k - 1));

        expect(derived).toBeCloseTo(0.528282, 6);
        expect(CRITICAL_PRESSURE_RATIO_AIR).toBeCloseTo(derived, 3);
    });

    it('implies a free air density of about 1.20 kg/m3 at reference conditions', () => {
        const density =
            FREE_AIR_REFERENCE_PRESSURE_PA /
            (R * FREE_AIR_REFERENCE_TEMPERATURE_K);

        expect(density).toBeCloseTo(1.204, 3);
    });
});

describe('values that must stay unknown', () => {
    it('has no tariff until a real schedule is entered', () => {
        expect(DEFAULT_CALC_SETTINGS.tariff).toBeNull();
        // A zero tariff would silently cost every leak at R0/year.
        expect(DEFAULT_CALC_SETTINGS.tariff).not.toBe(0);
    });

    it('has no compressor specific power until site data is entered', () => {
        expect(DEFAULT_COMPRESSOR_SPEC.specificPowerKwPerM3PerSec).toBeNull();
        expect(DEFAULT_COMPRESSOR_SPEC.specificPowerKwPerM3PerSec).not.toBe(0);
        expect(DEFAULT_COMPRESSOR_SPEC.source).toBeNull();
    });
});

describe('compressor defaults are assumptions, and are overridable', () => {
    it('defaults the isentropic efficiency to 0.75', () => {
        expect(DEFAULT_COMPRESSOR_SPEC.isentropicEfficiency).toBe(0.75);
    });

    it('defaults the polytropic exponent to the cooled-path value', () => {
        expect(DEFAULT_COMPRESSOR_SPEC.polytropicExponent).toBe(
            POLYTROPIC_EXPONENT_COOLED,
        );
        expect(POLYTROPIC_EXPONENT_COOLED).toBe(1.35);
    });

    it('carries the assumptions as settings, so a reviewer can push efficiency to 0.70', () => {
        const stricter = {
            ...DEFAULT_COMPRESSOR_SPEC,
            isentropicEfficiency: 0.7,
        };

        expect(stricter.isentropicEfficiency).toBe(0.7);
        // The default is untouched: nothing here is a shared mutable object.
        expect(DEFAULT_COMPRESSOR_SPEC.isentropicEfficiency).toBe(0.75);
    });
});

describe('leak type catalogue', () => {
    it('covers all eight rows of spec section 4', () => {
        expect(LEAK_TYPE_CATALOGUE).toHaveLength(8);
    });

    it('gives every entry a unique id', () => {
        const ids = LEAK_TYPE_CATALOGUE.map((type) => type.id);

        expect(new Set(ids).size).toBe(ids.length);
    });

    it('keeps exactly two entries in the deliberate-open-line category', () => {
        const openLines = LEAK_TYPE_CATALOGUE.filter(
            (type) => type.category === 'deliberate-open-line',
        );

        expect(openLines.map((type) => type.id)).toEqual([
            'refuge-bay-self-ventilation',
            'open-line-for-cooling',
        ]);
    });

    it('gives every leak a default equivalent diameter', () => {
        const leaks = LEAK_TYPE_CATALOGUE.filter(
            (type) => type.category === 'leak',
        );

        expect(leaks).toHaveLength(6);
        for (const leak of leaks) {
            expect(leak.equivalentDiameterMm).toBeGreaterThan(0);
        }
    });

    it('leaves the open-line diameters null, because the bore is not a catalogue number', () => {
        const openLines = LEAK_TYPE_CATALOGUE.filter(
            (type) => type.category === 'deliberate-open-line',
        );

        for (const openLine of openLines) {
            expect(openLine.equivalentDiameterMm).toBeNull();
            // Fully open line, spec section 3.1.
            expect(openLine.dischargeCoefficient).toBe(
                DISCHARGE_COEFFICIENTS.fullyOpen,
            );
        }
    });

    it('uses a discharge coefficient from the named set for every entry', () => {
        const allowed = Object.values(DISCHARGE_COEFFICIENTS);

        for (const type of LEAK_TYPE_CATALOGUE) {
            expect(allowed).toContain(type.dischargeCoefficient);
        }
    });

    it('has the failed hose coupling at 3 mm, the hand-check case', () => {
        const coupling = LEAK_TYPE_CATALOGUE.find(
            (type) => type.id === 'failed-hose-coupling',
        );

        expect(coupling?.equivalentDiameterMm).toBe(3);
        expect(coupling?.dischargeCoefficient).toBe(
            DISCHARGE_COEFFICIENTS.sharpEdged,
        );
    });
});

describe('default calculation settings', () => {
    it('runs a mine line at 400-500 kPa gauge', () => {
        expect(DEFAULT_CALC_SETTINGS.linePressureKpaG).toBeGreaterThanOrEqual(400);
        expect(DEFAULT_CALC_SETTINGS.linePressureKpaG).toBeLessThanOrEqual(500);
    });

    it('assumes continuous operation', () => {
        expect(DEFAULT_CALC_SETTINGS.operatingHoursPerYear).toBe(8760);
    });

    it('keeps the calendar year separate from the operating hours default', () => {
        // They share a value today because mines run continuously. They are not
        // the same quantity: one is a calendar fact, the other is a setting.
        expect(HOURS_PER_YEAR).toBe(8760);
    });

    it('carries a plus or minus 30 percent diameter band', () => {
        expect(DIAMETER_UNCERTAINTY_FRACTION).toBe(0.3);
        expect(DEFAULT_CALC_SETTINGS.diameterUncertaintyFraction).toBe(
            DIAMETER_UNCERTAINTY_FRACTION,
        );
    });

    it('uses the standard atmosphere as the downstream pressure', () => {
        expect(ATMOSPHERIC_PRESSURE_PA).toBe(101325);
        expect(DEFAULT_CALC_SETTINGS.atmosphericPressurePa).toBe(
            ATMOSPHERIC_PRESSURE_PA,
        );
    });
});

describe('realised saving caveat', () => {
    it('exists as one string, so the surface screen and the README cannot drift', () => {
        expect(REALISED_SAVING_CAVEAT).toContain('potential');
        expect(REALISED_SAVING_CAVEAT).toMatch(/compressor/i);
    });
});
