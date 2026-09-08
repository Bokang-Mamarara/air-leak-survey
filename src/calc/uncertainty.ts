/**
 * Propagation of the equivalent-diameter uncertainty through to rand per year.
 *
 * The person underground has no flow meter. They pick the closest description
 * of what they heard from a catalogue, and the tool infers a diameter from it.
 * That inference is the dominant uncertainty in the whole calculation, and it
 * is far larger than the uncertainty in any of the equations downstream of it.
 * Reporting a single number would be a claim the input cannot support.
 *
 * The mechanism is deliberately small. Every step from diameter to cost — area,
 * mass flow, compressor power, annual energy, annual cost — is monotonically
 * increasing in diameter. A monotonic function maps an interval to an interval
 * by its endpoints, so the entire chain propagates by carrying three numbers
 * through the same functions the expected value goes through. There is no
 * second implementation of the physics for the low and high cases, which is
 * what makes the band trustworthy.
 *
 * The one thing to notice: flow goes with the square of diameter. A symmetric
 * plus or minus 30 percent on diameter becomes an asymmetric minus 51 to plus
 * 69 percent on everything after it, and `mapRange` does not re-centre that.
 */

import type { Range } from './types.ts';

/**
 * A band around a nominal equivalent diameter, mm.
 *
 * The fraction is applied uniformly to every leak type. That is a judgement,
 * not a measured distribution: there is no data to justify six different bands,
 * so one documented figure is the honest form. A fraction of 0 collapses the
 * band to a point, which is the right answer when the diameter was measured
 * rather than inferred.
 */
export function diameterBandMm(nominalMm: number, fraction: number): Range {
    if (!Number.isFinite(nominalMm) || nominalMm <= 0) {
        throw new RangeError(
            `The nominal diameter must be a positive number; received ${nominalMm}.`,
        );
    }
    if (!Number.isFinite(fraction) || fraction < 0 || fraction >= 1) {
        throw new RangeError(
            `The uncertainty fraction must be at least 0 and less than 1; ` +
                `received ${fraction}. A fraction of 1 would put the low end of ` +
                'the band at a zero diameter, which is not a leak.',
        );
    }

    return {
        low: nominalMm * (1 - fraction),
        expected: nominalMm,
        high: nominalMm * (1 + fraction),
    };
}

/**
 * A band around a nominal discharge coefficient, used for a deliberate open
 * line rather than a leak.
 *
 * An open line's bore is a real, measured nominal pipe size, not inferred
 * from a catalogue guess the way a leak's equivalent diameter is — see
 * `openLine.ts`, where the bore is carried as a point value instead of a
 * band. What is genuinely uncertain there is how the opened end actually
 * discharges: an unbevelled cut, a missing flange, a valve half off its seat
 * all sit somewhere between a sharp-edged orifice and an idealised fully-open
 * bore. This bands the coefficient instead of the diameter. It is a
 * differently derived band, not a more confident one.
 *
 * Clamped at 1.0, the physical ceiling for this model's discharge
 * coefficient (`DISCHARGE_COEFFICIENTS.fullyOpen` in `constants.ts`) — a real
 * opening cannot discharge more freely than an idealised fully-open bore.
 */
export function coefficientBand(nominal: number, fraction: number): Range {
    if (!Number.isFinite(nominal) || nominal <= 0 || nominal > 1) {
        throw new RangeError(
            `The nominal discharge coefficient must be greater than 0 and at ` +
                `most 1; received ${nominal}.`,
        );
    }
    if (!Number.isFinite(fraction) || fraction < 0 || fraction >= 1) {
        throw new RangeError(
            `The uncertainty fraction must be at least 0 and less than 1; ` +
                `received ${fraction}.`,
        );
    }

    return {
        low: nominal * (1 - fraction),
        expected: nominal,
        high: Math.min(nominal * (1 + fraction), 1),
    };
}

/**
 * Push a band through one step of the calculation.
 *
 * The step must be monotonically increasing — every step in this tool is — and
 * that is checked rather than assumed. A step that inverted the band would
 * quietly swap the low and high figures and the register would report a
 * confident nonsense, so it throws here instead.
 */
export function mapRange(range: Range, step: (value: number) => number): Range {
    assertOrdered(range, 'The band given to mapRange');

    const mapped: Range = {
        low: step(range.low),
        expected: step(range.expected),
        high: step(range.high),
    };

    for (const [name, value] of Object.entries(mapped)) {
        if (!Number.isFinite(value)) {
            throw new RangeError(
                `Mapping the band produced a ${name} value of ${value}. ` +
                    'Every step from diameter to rand per year must return a ' +
                    'finite number.',
            );
        }
    }

    assertOrdered(
        mapped,
        'Mapping the band produced an out-of-order result. Every step from ' +
            'diameter to rand per year must be monotonically increasing for a ' +
            'band to propagate by its endpoints. The result',
    );

    return mapped;
}

function assertOrdered(range: Range, subject: string): void {
    if (range.low > range.expected || range.expected > range.high) {
        throw new RangeError(
            `${subject} is out of order: low ${range.low}, ` +
                `expected ${range.expected}, high ${range.high}.`,
        );
    }
}
