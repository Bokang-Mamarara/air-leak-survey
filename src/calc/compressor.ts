/**
 * Compressor power required to make up a leak, by two methods, reported side by
 * side and never averaged.
 *
 * Theoretical — multi-stage polytropic compression with intercooling, per
 * stage:
 *
 *     W = m_dot . (n/(n-1)) . R . T1 . [ (P2/P1)^((n-1)/n) - 1 ] / eta
 *
 * The total pressure ratio is split equally across the stages and the air is
 * assumed to return to inlet temperature between them, which is what the
 * intercoolers are for. It needs no site data, which is exactly why it exists,
 * and it rests on three assumptions — n, eta and the stage count — every one of
 * which is a settings input rather than a constant, and every one of which is
 * named in the `basis` string that appears next to the figure on screen.
 *
 * Empirical — the mine's own specific power, kW per m3/s of free air delivered,
 * off its own compressor performance data. Where a site figure exists it beats
 * the theoretical number and the tool says so by setting `preferred` on it.
 *
 * Both are returned. The theoretical one is not deleted for disagreeing with
 * the measurement: the gap between them is information about the machine.
 */

import {
    FREE_AIR_REFERENCE_PRESSURE_PA,
    FREE_AIR_REFERENCE_TEMPERATURE_K,
    GAS_CONSTANT_AIR_J_PER_KG_K,
    KELVIN_AT_ZERO_CELSIUS,
    PA_PER_KPA,
} from './constants.ts';
import type { CompressorPowerEstimate, CompressorSpec } from './types.ts';

export interface CompressorPowerInput {
    massFlowKgPerS: number;
    spec: CompressorSpec;
    /** Compressor intake pressure, Pa absolute. The machine breathes surface air. */
    atmosphericPressurePa: number;
}

/**
 * One method's answer at a single operating point.
 *
 * This is the scalar form of `CompressorPowerEstimate` from `types.ts`, which
 * carries a `Range` instead of a number. `index.ts` runs the low, expected and
 * high mass flows through here and assembles the banded version. The `method`
 * field borrows its type from the banded one — `CompressorPowerEstimate['method']`
 * reads the type of that field out of the interface — so the two method names
 * are written down once.
 */
export interface PointPowerEstimate {
    method: CompressorPowerEstimate['method'];
    /** Null when the method cannot run, never zero. */
    powerKw: number | null;
    preferred: boolean;
    basis: string;
}

export interface CompressorPowerBreakdown {
    theoretical: PointPowerEstimate;
    empirical: PointPowerEstimate;
}

/**
 * Density of free air at the reference conditions specific power is quoted
 * against. About 1.2043 kg/m3.
 */
const FREE_AIR_DENSITY_KG_PER_M3 =
    FREE_AIR_REFERENCE_PRESSURE_PA /
    (GAS_CONSTANT_AIR_J_PER_KG_K * FREE_AIR_REFERENCE_TEMPERATURE_K);

/**
 * Volume the leaking mass would occupy at intake conditions, m3/s.
 *
 * Free air delivery is quoted at intake conditions by definition, which is what
 * makes one machine's specific power comparable with another's.
 */
export function freeAirDeliveryM3PerS(massFlowKgPerS: number): number {
    requireNonNegativeFinite(massFlowKgPerS, 'mass flow');

    return massFlowKgPerS / FREE_AIR_DENSITY_KG_PER_M3;
}

/** Shaft power by the theoretical polytropic path, kW. */
export function theoreticalPolytropicPowerKw(
    input: CompressorPowerInput,
): number {
    const { massFlowKgPerS, spec, atmosphericPressurePa } = input;
    const {
        polytropicExponent: n,
        isentropicEfficiency: eta,
        stageCount,
        dischargePressureKpaG,
        inletTemperatureC,
    } = spec;

    requireNonNegativeFinite(massFlowKgPerS, 'mass flow');
    requirePositiveFinite(atmosphericPressurePa, 'atmospheric pressure');
    requirePositiveInteger(stageCount, 'stage count');

    if (!Number.isFinite(n) || n <= 1) {
        throw new RangeError(
            `The polytropic exponent must be greater than 1; received ${n}. ` +
                'At n = 1 the compression is isothermal and this form of the ' +
                'work equation is undefined.',
        );
    }
    if (!Number.isFinite(eta) || eta <= 0 || eta > 1) {
        throw new RangeError(
            `The isentropic efficiency must be greater than 0 and at most 1; received ${eta}.`,
        );
    }

    const inletPressurePa = atmosphericPressurePa;
    const dischargePressurePa =
        dischargePressureKpaG * PA_PER_KPA + atmosphericPressurePa;

    if (dischargePressurePa <= inletPressurePa) {
        throw new RangeError(
            `The compressor discharge pressure (${dischargePressureKpaG} kPa gauge) ` +
                'must be above intake pressure; there is no compression otherwise.',
        );
    }

    const inletTemperatureK = inletTemperatureC + KELVIN_AT_ZERO_CELSIUS;
    requirePositiveFinite(inletTemperatureK, 'compressor inlet temperature');

    // Equal pressure ratio per stage, intercooled back to inlet temperature.
    const totalPressureRatio = dischargePressurePa / inletPressurePa;
    const stagePressureRatio = Math.pow(totalPressureRatio, 1 / stageCount);

    const exponent = (n - 1) / n;
    const powerPerStageW =
        (massFlowKgPerS *
            (n / (n - 1)) *
            GAS_CONSTANT_AIR_J_PER_KG_K *
            inletTemperatureK *
            (Math.pow(stagePressureRatio, exponent) - 1)) /
        eta;

    return (powerPerStageW * stageCount) / 1000;
}

/**
 * Shaft power from the mine's own specific power figure, kW.
 *
 * Returns null when no site figure has been entered. Not zero: a zero here
 * would report a leak as free.
 */
export function empiricalPowerKw(
    freeAirDeliveredM3PerS: number,
    specificPowerKwPerM3PerSec: number | null,
): number | null {
    if (specificPowerKwPerM3PerSec === null) {
        return null;
    }

    requireNonNegativeFinite(freeAirDeliveredM3PerS, 'free air delivery');
    requirePositiveFinite(specificPowerKwPerM3PerSec, 'specific power');

    return freeAirDeliveredM3PerS * specificPowerKwPerM3PerSec;
}

/**
 * Both methods at one operating point, with the site-data method marked
 * preferred whenever a site figure exists.
 *
 * The return type has two named fields and no third. There is deliberately
 * nowhere to put an average of them: the two numbers answer different
 * questions, and a blended figure would hide which one the reader is looking
 * at.
 */
export function compressorPower(
    input: CompressorPowerInput,
): CompressorPowerBreakdown {
    const { massFlowKgPerS, spec } = input;
    const { specificPowerKwPerM3PerSec, source } = spec;

    const hasSiteData = specificPowerKwPerM3PerSec !== null;

    const theoreticalPowerKw = theoreticalPolytropicPowerKw(input);
    const empiricalKw = empiricalPowerKw(
        freeAirDeliveryM3PerS(massFlowKgPerS),
        specificPowerKwPerM3PerSec,
    );

    return {
        theoretical: {
            method: 'theoretical-polytropic',
            powerKw: theoreticalPowerKw,
            preferred: !hasSiteData,
            basis:
                `Theoretical polytropic, n = ${spec.polytropicExponent}, ` +
                `eta = ${spec.isentropicEfficiency} assumed, ` +
                `${spec.stageCount} stages intercooled, ` +
                `discharging at ${spec.dischargePressureKpaG} kPa gauge.`,
        },
        empirical: {
            method: 'empirical-specific-power',
            powerKw: empiricalKw,
            preferred: hasSiteData,
            basis: hasSiteData
                ? `Site compressor data, ${specificPowerKwPerM3PerSec} kW per m3/s ` +
                  `free air delivered. Source: ${source ?? 'not stated'}.`
                : 'No site compressor specific power entered. Enter one in ' +
                  'settings and this figure replaces the theoretical one.',
        },
    };
}

function requirePositiveFinite(value: number, name: string): void {
    if (!Number.isFinite(value) || value <= 0) {
        throw new RangeError(
            `The ${name} must be a positive number; received ${value}.`,
        );
    }
}

function requireNonNegativeFinite(value: number, name: string): void {
    if (!Number.isFinite(value) || value < 0) {
        throw new RangeError(
            `The ${name} must be zero or a positive number; received ${value}.`,
        );
    }
}

function requirePositiveInteger(value: number, name: string): void {
    if (!Number.isInteger(value) || value < 1) {
        throw new RangeError(
            `The ${name} must be a whole number of at least 1; received ${value}.`,
        );
    }
}
