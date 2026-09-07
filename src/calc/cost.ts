/**
 * Annual cost of a leak, from a power figure and a time-of-use tariff.
 *
 *     annual cost = sum over periods of  kW x hours in period x rate in period
 *
 * The tariff is entered as its real structure — peak, standard and off-peak,
 * across a high and a low demand season — rather than as a single blended rate.
 * Two reasons. The six numbers can be checked against an actual electricity
 * account, where a blended rate someone worked out once cannot. And the
 * seasonal and period split is what a mine's energy manager already thinks in,
 * so the settings screen asks for numbers they have rather than numbers they
 * would have to derive.
 *
 * There is no default tariff. Rates change annually and differ by supply
 * agreement, so `constants.ts` ships null and every function here returns null
 * until a real schedule is entered. Null is not zero: zero would report a leak
 * as free, and "free" and "rate unknown" are different statements.
 */

import { HOURS_PER_YEAR } from './constants.ts';
import type { TariffSchedule, TimeOfUseSplit } from './types.ts';

export interface AnnualCostInput {
    powerKw: number;
    /** Null until a real schedule is entered. */
    tariff: TariffSchedule | null;
    /** Hours a year this leak is actually pressurised. */
    operatingHoursPerYear: number;
}

/** Energy lost over a year, kWh. */
export function annualEnergyKwh(
    powerKw: number,
    operatingHoursPerYear: number,
): number {
    requireNonNegativeFinite(powerKw, 'power');
    requireHoursWithinYear(operatingHoursPerYear, 'operating hours');

    return powerKw * operatingHoursPerYear;
}

/** Total hours the schedule accounts for, across both seasons. */
export function totalTariffHours(tariff: TariffSchedule): number {
    return (
        sumSplit(tariff.hoursPerYear.highDemandSeason) +
        sumSplit(tariff.hoursPerYear.lowDemandSeason)
    );
}

/**
 * Annual cost in rand, or null when no tariff has been entered.
 *
 * Where the leak is pressurised for fewer hours than the tariff covers, those
 * hours are spread across the tariff periods pro rata. That is an assumption,
 * and it is the conservative one: a section that is only live during production
 * shifts sits in peak more than pro rata implies, so this understates such a
 * leak. Knowing better would mean asking which hours the leak is live, which is
 * not a question anyone can answer standing in a drive. Listed as a limitation.
 */
export function annualCostZar(input: AnnualCostInput): number | null {
    const { powerKw, tariff, operatingHoursPerYear } = input;

    if (tariff === null) {
        return null;
    }

    requireNonNegativeFinite(powerKw, 'power');
    requireHoursWithinYear(operatingHoursPerYear, 'operating hours');
    requireValidSchedule(tariff);

    const scheduleHours = totalTariffHours(tariff);

    if (operatingHoursPerYear > scheduleHours) {
        throw new RangeError(
            `The leak is marked as pressurised for ${operatingHoursPerYear} hours ` +
                `a year, but the tariff schedule only accounts for ${scheduleHours}. ` +
                'A leak cannot be live for more hours than the tariff covers.',
        );
    }

    // Pro rata: 1 when the leak is pressurised for the whole schedule.
    const dutyFraction = operatingHoursPerYear / scheduleHours;

    const seasons = ['highDemandSeason', 'lowDemandSeason'] as const;
    const periods = ['peak', 'standard', 'offPeak'] as const;

    let costZar = 0;

    for (const season of seasons) {
        for (const period of periods) {
            const hours = tariff.hoursPerYear[season][period] * dutyFraction;
            const rate = tariff.ratesZarPerKwh[season][period];

            costZar += powerKw * hours * rate;
        }
    }

    return costZar;
}

function sumSplit(split: TimeOfUseSplit): number {
    return split.peak + split.standard + split.offPeak;
}

function requireValidSchedule(tariff: TariffSchedule): void {
    const seasons = ['highDemandSeason', 'lowDemandSeason'] as const;
    const periods = ['peak', 'standard', 'offPeak'] as const;

    for (const season of seasons) {
        for (const period of periods) {
            requireNonNegativeFinite(
                tariff.hoursPerYear[season][period],
                `${season} ${period} hours`,
            );
            requireNonNegativeFinite(
                tariff.ratesZarPerKwh[season][period],
                `${season} ${period} rate`,
            );
        }
    }

    const scheduleHours = totalTariffHours(tariff);

    if (scheduleHours <= 0) {
        throw new RangeError(
            'The tariff schedule accounts for no hours at all. Enter the hours ' +
                'spent in each period across both seasons.',
        );
    }
    if (scheduleHours > HOURS_PER_YEAR) {
        throw new RangeError(
            `The tariff schedule accounts for ${scheduleHours} hours, but a year ` +
                `has ${HOURS_PER_YEAR}. The period hours have been double counted.`,
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

function requireHoursWithinYear(value: number, name: string): void {
    requireNonNegativeFinite(value, name);

    if (value > HOURS_PER_YEAR) {
        throw new RangeError(
            `The ${name} cannot exceed ${HOURS_PER_YEAR}, the hours in a year; ` +
                `received ${value}.`,
        );
    }
}
