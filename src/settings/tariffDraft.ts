/**
 * The tariff form's in-progress state.
 *
 * `TariffSchedule` (src/calc/types.ts) has no partial form — it is complete
 * or `CalcSettings.tariff` is `null`, and `cost.ts` depends on that being
 * true. But a person typing twelve rates and six hour figures needs
 * somewhere to keep the eleven they have already entered while they go find
 * the twelfth, without that draft ever being mistaken for a real,
 * cost-affecting tariff. `TariffDraftFields` is that somewhere: every value
 * is a string (so a half-typed "1." or an empty box has somewhere to live),
 * it is persisted separately from `CalcSettings.tariff` in Dexie, and
 * `tryBuildTariff` is the single gate a draft has to pass before it is
 * allowed to become a real `TariffSchedule`.
 */

import type { TariffSchedule, TimeOfUseSplit } from '../calc/types.ts';

export interface TimeOfUseDraft {
    peak: string;
    standard: string;
    offPeak: string;
}

export interface TariffDraftFields {
    ratesZarPerKwh: {
        highDemandSeason: TimeOfUseDraft;
        lowDemandSeason: TimeOfUseDraft;
    };
    hoursPerYear: {
        highDemandSeason: TimeOfUseDraft;
        lowDemandSeason: TimeOfUseDraft;
    };
    source: string;
}

/** The twelve numeric fields, in a fixed order, used everywhere a draft is walked. */
function numericFields(draft: TariffDraftFields): string[] {
    return [
        draft.ratesZarPerKwh.highDemandSeason.peak,
        draft.ratesZarPerKwh.highDemandSeason.standard,
        draft.ratesZarPerKwh.highDemandSeason.offPeak,
        draft.ratesZarPerKwh.lowDemandSeason.peak,
        draft.ratesZarPerKwh.lowDemandSeason.standard,
        draft.ratesZarPerKwh.lowDemandSeason.offPeak,
        draft.hoursPerYear.highDemandSeason.peak,
        draft.hoursPerYear.highDemandSeason.standard,
        draft.hoursPerYear.highDemandSeason.offPeak,
        draft.hoursPerYear.lowDemandSeason.peak,
        draft.hoursPerYear.lowDemandSeason.standard,
        draft.hoursPerYear.lowDemandSeason.offPeak,
    ];
}

export const TARIFF_NUMERIC_FIELD_COUNT = 12;

function blankSplit(): TimeOfUseDraft {
    return { peak: '', standard: '', offPeak: '' };
}

export function blankTariffDraft(): TariffDraftFields {
    return {
        ratesZarPerKwh: { highDemandSeason: blankSplit(), lowDemandSeason: blankSplit() },
        hoursPerYear: { highDemandSeason: blankSplit(), lowDemandSeason: blankSplit() },
        source: '',
    };
}

function splitToDraft(split: TimeOfUseSplit): TimeOfUseDraft {
    return { peak: String(split.peak), standard: String(split.standard), offPeak: String(split.offPeak) };
}

/** A complete tariff, rendered back into the same string-field shape the form edits. */
export function tariffToDraft(tariff: TariffSchedule): TariffDraftFields {
    return {
        ratesZarPerKwh: {
            highDemandSeason: splitToDraft(tariff.ratesZarPerKwh.highDemandSeason),
            lowDemandSeason: splitToDraft(tariff.ratesZarPerKwh.lowDemandSeason),
        },
        hoursPerYear: {
            highDemandSeason: splitToDraft(tariff.hoursPerYear.highDemandSeason),
            lowDemandSeason: splitToDraft(tariff.hoursPerYear.lowDemandSeason),
        },
        source: tariff.source,
    };
}

/** How many of the twelve numeric fields currently hold a valid number. */
export function filledNumericFieldCount(draft: TariffDraftFields): number {
    return numericFields(draft).filter((value) => value.trim() !== '' && Number.isFinite(Number(value)))
        .length;
}

export function hasSource(draft: TariffDraftFields): boolean {
    return draft.source.trim() !== '';
}

function parseSplit(split: TimeOfUseDraft): TimeOfUseSplit | null {
    const peak = Number(split.peak);
    const standard = Number(split.standard);
    const offPeak = Number(split.offPeak);

    if (
        split.peak.trim() === '' ||
        split.standard.trim() === '' ||
        split.offPeak.trim() === '' ||
        !Number.isFinite(peak) ||
        !Number.isFinite(standard) ||
        !Number.isFinite(offPeak)
    ) {
        return null;
    }

    return { peak, standard, offPeak };
}

/**
 * Builds a real `TariffSchedule` once every field validates, or `null`
 * otherwise. `null` here means exactly what `CalcSettings.tariff = null`
 * means everywhere else in this project: not known yet, never zero.
 */
export function tryBuildTariff(draft: TariffDraftFields): TariffSchedule | null {
    if (!hasSource(draft)) {
        return null;
    }

    const highRates = parseSplit(draft.ratesZarPerKwh.highDemandSeason);
    const lowRates = parseSplit(draft.ratesZarPerKwh.lowDemandSeason);
    const highHours = parseSplit(draft.hoursPerYear.highDemandSeason);
    const lowHours = parseSplit(draft.hoursPerYear.lowDemandSeason);

    if (!highRates || !lowRates || !highHours || !lowHours) {
        return null;
    }

    return {
        currency: 'ZAR',
        ratesZarPerKwh: { highDemandSeason: highRates, lowDemandSeason: lowRates },
        hoursPerYear: { highDemandSeason: highHours, lowDemandSeason: lowHours },
        source: draft.source.trim(),
    };
}

/** Sum of the six entered hours fields, or null while any of them is still blank/invalid. */
export function totalDraftHours(draft: TariffDraftFields): number | null {
    const highHours = parseSplit(draft.hoursPerYear.highDemandSeason);
    const lowHours = parseSplit(draft.hoursPerYear.lowDemandSeason);

    if (!highHours || !lowHours) {
        return null;
    }

    return (
        highHours.peak +
        highHours.standard +
        highHours.offPeak +
        lowHours.peak +
        lowHours.standard +
        lowHours.offPeak
    );
}
