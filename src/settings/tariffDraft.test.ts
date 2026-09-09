import { describe, expect, it } from 'vitest';
import {
    blankTariffDraft,
    filledNumericFieldCount,
    tariffToDraft,
    totalDraftHours,
    tryBuildTariff,
    type TariffDraftFields,
} from './tariffDraft.ts';
import type { TariffSchedule } from '../calc/types.ts';

const COMPLETE_TARIFF: TariffSchedule = {
    currency: 'ZAR',
    ratesZarPerKwh: {
        highDemandSeason: { peak: 6.5, standard: 2.1, offPeak: 1.2 },
        lowDemandSeason: { peak: 1.8, standard: 1.1, offPeak: 0.6 },
    },
    hoursPerYear: {
        highDemandSeason: { peak: 300, standard: 900, offPeak: 600 },
        lowDemandSeason: { peak: 1200, standard: 3200, offPeak: 2560 },
    },
    source: 'Eskom Megaflex 2026, high/low demand seasons',
};

function withField(
    draft: TariffDraftFields,
    path: (d: TariffDraftFields) => void,
): TariffDraftFields {
    const next = structuredClone(draft);
    path(next);
    return next;
}

describe('blankTariffDraft', () => {
    it('starts with every field empty', () => {
        expect(filledNumericFieldCount(blankTariffDraft())).toBe(0);
        expect(tryBuildTariff(blankTariffDraft())).toBeNull();
    });
});

describe('tryBuildTariff', () => {
    it('returns null while any of the twelve numbers is missing', () => {
        const almostComplete = withField(
            tariffToDraft(COMPLETE_TARIFF),
            (d) => {
                d.hoursPerYear.lowDemandSeason.offPeak = '';
            },
        );

        expect(filledNumericFieldCount(almostComplete)).toBe(11);
        expect(tryBuildTariff(almostComplete)).toBeNull();
    });

    it('returns null while the source is blank, even with all twelve numbers present', () => {
        const noSource = withField(tariffToDraft(COMPLETE_TARIFF), (d) => {
            d.source = '';
        });

        expect(filledNumericFieldCount(noSource)).toBe(12);
        expect(tryBuildTariff(noSource)).toBeNull();
    });

    it('returns null on a non-numeric field rather than silently coercing it', () => {
        const invalid = withField(tariffToDraft(COMPLETE_TARIFF), (d) => {
            d.ratesZarPerKwh.highDemandSeason.peak = 'six';
        });

        expect(tryBuildTariff(invalid)).toBeNull();
    });

    it('builds the full schedule once every field validates', () => {
        const draft = tariffToDraft(COMPLETE_TARIFF);

        expect(filledNumericFieldCount(draft)).toBe(12);
        expect(tryBuildTariff(draft)).toEqual(COMPLETE_TARIFF);
    });

    it('round-trips a complete tariff through tariffToDraft', () => {
        expect(tryBuildTariff(tariffToDraft(COMPLETE_TARIFF))).toEqual(COMPLETE_TARIFF);
    });
});

describe('totalDraftHours', () => {
    it('is null while any hours field is unset', () => {
        expect(totalDraftHours(blankTariffDraft())).toBeNull();
    });

    it('sums all six hours fields once they are all present', () => {
        expect(totalDraftHours(tariffToDraft(COMPLETE_TARIFF))).toBe(8760);
    });
});
