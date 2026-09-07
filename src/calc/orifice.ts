/**
 * Mass flow of air escaping through a leak, modelled as flow through a
 * sharp-edged orifice.
 *
 * Mine reticulation runs at 400-500 kPa gauge. Venting to atmosphere puts the
 * pressure ratio at roughly 0.17, well under the critical value of 0.528 for
 * air, so the throat is sonic and the flow is choked:
 *
 *     m_dot = 0.0404 . Cd . A . P1 / sqrt(T1)
 *
 * with m_dot in kg/s, A in m2, P1 in Pa absolute and T1 in K. The leading
 * constant is sqrt(k/R) . (2/(k+1))^((k+1)/(2(k-1))) for k = 1.4 and
 * R = 287 J/kg.K — see `constants.ts`, where the test recomputes it.
 *
 * Once choked, the flow no longer depends on anything downstream. That is why
 * the downstream pressure appears in the input: not to compute the flow, but to
 * prove the assumption the flow rests on. The check is explicit and the failure
 * is loud — see `NotChokedError`.
 */

import {
    CHOKED_FLOW_COEFFICIENT,
    CRITICAL_PRESSURE_RATIO_AIR,
} from './constants.ts';

export interface ChokedFlowInput {
    orificeDiameterMm: number;
    /** Geometry of the opening. See DISCHARGE_COEFFICIENTS in `constants.ts`. */
    dischargeCoefficient: number;
    /** Line pressure, absolute, Pa. Not gauge. */
    upstreamAbsolutePressurePa: number;
    /** Air temperature in the line, K. */
    upstreamTemperatureK: number;
    /**
     * What the leak discharges into, absolute, Pa. Usually atmospheric. Used
     * only to confirm the flow is choked; it does not enter the flow equation.
     */
    downstreamAbsolutePressurePa: number;
}

export interface OrificeFlowResult {
    massFlowKgPerS: number;
    orificeAreaM2: number;
    /** Downstream over upstream, absolute. */
    pressureRatio: number;
    /** Always true on a returned result. The alternative is the error below. */
    choked: boolean;
}

/**
 * Thrown when someone asks for a flow the model does not cover.
 *
 * The message is written as an engineering statement rather than a stack trace
 * because the person most likely to meet it is reading the code, not running
 * it. A subsonic branch is deliberately not implemented: no line at 400-500 kPa
 * gauge venting to atmosphere can reach this condition, so the branch would be
 * unreachable on real inputs. See DECISIONS.md.
 */
export class NotChokedError extends Error {
    readonly pressureRatio: number;
    readonly criticalPressureRatio: number;

    constructor(pressureRatio: number, criticalPressureRatio: number) {
        super(
            `Pressure ratio ${round(pressureRatio, 3)} exceeds the critical ` +
                `value of ${criticalPressureRatio}; flow is not choked. ` +
                'This tool models choked flow only. A reticulation line at ' +
                '400-500 kPa gauge venting to atmosphere sits near 0.17, so a ' +
                'ratio this high means either the upstream pressure given is ' +
                'too low for the choked assumption, or the leak vents into a ' +
                'pressurised space rather than to atmosphere.',
        );
        this.name = 'NotChokedError';
        this.pressureRatio = pressureRatio;
        this.criticalPressureRatio = criticalPressureRatio;
    }
}

/** Cross-sectional area of a round opening, m2. Note the square on diameter. */
export function orificeAreaM2(diameterMm: number): number {
    requirePositiveFinite(diameterMm, 'orifice diameter');

    const radiusM = diameterMm / 2 / 1000;

    return Math.PI * radiusM * radiusM;
}

/**
 * True when the throat is sonic and the flow has stopped caring about
 * downstream conditions. The critical ratio itself counts as choked.
 */
export function isChoked(
    downstreamAbsolutePressurePa: number,
    upstreamAbsolutePressurePa: number,
): boolean {
    requirePositiveFinite(upstreamAbsolutePressurePa, 'upstream pressure');
    requirePositiveFinite(downstreamAbsolutePressurePa, 'downstream pressure');

    return (
        downstreamAbsolutePressurePa / upstreamAbsolutePressurePa <=
        CRITICAL_PRESSURE_RATIO_AIR
    );
}

/**
 * Mass flow through a choked orifice, kg/s.
 *
 * Throws `NotChokedError` if the pressure ratio is above critical, rather than
 * applying the choked equation outside its range and returning a number that
 * looks like an answer.
 */
export function chokedMassFlowKgPerS(
    input: ChokedFlowInput,
): OrificeFlowResult {
    const {
        orificeDiameterMm,
        dischargeCoefficient,
        upstreamAbsolutePressurePa,
        upstreamTemperatureK,
        downstreamAbsolutePressurePa,
    } = input;

    requirePositiveFinite(upstreamAbsolutePressurePa, 'upstream pressure');
    requirePositiveFinite(downstreamAbsolutePressurePa, 'downstream pressure');
    requirePositiveFinite(upstreamTemperatureK, 'upstream temperature');
    requireFraction(dischargeCoefficient, 'discharge coefficient');

    const pressureRatio =
        downstreamAbsolutePressurePa / upstreamAbsolutePressurePa;

    if (pressureRatio > CRITICAL_PRESSURE_RATIO_AIR) {
        throw new NotChokedError(pressureRatio, CRITICAL_PRESSURE_RATIO_AIR);
    }

    const areaM2 = orificeAreaM2(orificeDiameterMm);

    const massFlowKgPerS =
        (CHOKED_FLOW_COEFFICIENT *
            dischargeCoefficient *
            areaM2 *
            upstreamAbsolutePressurePa) /
        Math.sqrt(upstreamTemperatureK);

    return {
        massFlowKgPerS,
        orificeAreaM2: areaM2,
        pressureRatio,
        choked: true,
    };
}

function requirePositiveFinite(value: number, name: string): void {
    if (!Number.isFinite(value) || value <= 0) {
        throw new RangeError(
            `The ${name} must be a positive number; received ${value}.`,
        );
    }
}

function requireFraction(value: number, name: string): void {
    if (!Number.isFinite(value) || value <= 0 || value > 1) {
        throw new RangeError(
            `The ${name} must be greater than 0 and at most 1; received ${value}.`,
        );
    }
}

/** Keeps the error message readable without pulling in a formatting library. */
function round(value: number, decimals: number): number {
    return Number(value.toFixed(decimals));
}
