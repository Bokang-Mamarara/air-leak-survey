/**
 * Builds the register's CSV export as a plain string, ready for a client-side
 * `Blob` download. Pure and DOM-free so it can be unit tested without a
 * browser: `RegisterScreen.tsx` is the only place that touches `Blob` or
 * `URL.createObjectURL`.
 *
 * Every `Range` gets three separate numeric columns — low, expected, high —
 * rather than a single `"1.5-3.2"` string. Excel reads a hyphenated numeric
 * range like that as a date, silently destroying the figure; separate
 * columns are the only representation that survives opening the file.
 *
 * A missing cost or power figure (no tariff set, or the line was not choked)
 * is left blank, never a fabricated `0` — the on-screen register spells this
 * out as "tariff not set" instead of a blank, per spec, but a blank numeric
 * CSV cell is the standard, unambiguous "no data" convention and mixing text
 * into a numeric column would confuse the very ranges this format exists to
 * protect.
 */

import type { LeakResult, LeakSummary, SummarisedLeak } from '../calc/index.ts';
import type { LeakRecord } from '../data/db.ts';

const COLUMNS = [
    'Category',
    'Leak type',
    'Repair status',
    'Position x (px)',
    'Position y (px)',
    'Diameter/bore low (mm)',
    'Diameter/bore expected (mm)',
    'Diameter/bore high (mm)',
    'Power method',
    'Power low (kW)',
    'Power expected (kW)',
    'Power high (kW)',
    'Energy low (kWh/yr)',
    'Energy expected (kWh/yr)',
    'Energy high (kWh/yr)',
    'Cost low (R/yr)',
    'Cost expected (R/yr)',
    'Cost high (R/yr)',
    'Logged at',
    'Note',
] as const;

export function buildCsv(
    summary: LeakSummary,
    recordsById: ReadonlyMap<string, LeakRecord>,
): string {
    const rows = [...summary.leaks, ...summary.openLines].map((row) =>
        buildRow(row, recordsById.get(row.id)),
    );

    return [COLUMNS.map(csvField).join(','), ...rows.map((row) => row.map(csvField).join(','))].join(
        '\n',
    );
}

function buildRow(row: SummarisedLeak, record: LeakRecord | undefined): (string | number)[] {
    const { result } = row;
    const preferredPower = preferredPowerEstimate(result);

    return [
        result.category === 'leak' ? 'Leak' : 'Open line',
        row.label,
        record?.repairStatus ?? '',
        record?.x ?? '',
        record?.y ?? '',
        result.equivalentDiameterMm?.low ?? '',
        result.equivalentDiameterMm?.expected ?? '',
        result.equivalentDiameterMm?.high ?? '',
        preferredPower?.method ?? '',
        preferredPower?.powerKw?.low ?? '',
        preferredPower?.powerKw?.expected ?? '',
        preferredPower?.powerKw?.high ?? '',
        result.annualEnergyKwh?.low ?? '',
        result.annualEnergyKwh?.expected ?? '',
        result.annualEnergyKwh?.high ?? '',
        result.annualCostZar?.low ?? '',
        result.annualCostZar?.expected ?? '',
        result.annualCostZar?.high ?? '',
        record?.loggedAt ?? '',
        record?.note ?? '',
    ];
}

/** The method `LeakResult.power` marks preferred, matching what the register displays. */
function preferredPowerEstimate(result: LeakResult) {
    if (result.power.empirical.preferred) {
        return result.power.empirical;
    }
    if (result.power.theoretical.preferred) {
        return result.power.theoretical;
    }
    return null;
}

function csvField(value: string | number): string {
    const text = String(value);

    if (/[",\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }

    return text;
}
