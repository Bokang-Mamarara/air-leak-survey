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
 *
 * Every numeric cell is rounded here, at export time, to the precision the
 * input actually supports — position to a whole pixel, diameter/bore to one
 * decimal, power to three significant figures, energy and cost to a whole
 * unit. `src/calc` itself is left alone: rounding inside the calculation is
 * how a rounding error becomes a physics error (see DECISIONS.md,
 * 2026-09-07, "Floating point is left alone inside the calculation"), so a
 * figure like `damaged-flexible-hose`'s 6 mm ±30% band still carries
 * `4.199999999999999` internally. It only gets rounded to `4.2` on the way
 * out, the same boundary the on-screen register already rounds at
 * (`formatRange`/`formatZarRange`) — this file was the one place that had
 * been reading the raw figures past that boundary.
 */

import type { CalcSettings, LeakResult, LeakSummary, SummarisedLeak } from '../calc/index.ts';
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
    'Band basis',
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
    settings: CalcSettings,
): string {
    const rows = [...summary.leaks, ...summary.openLines].map((row) =>
        buildRow(row, recordsById.get(row.id), settings),
    );

    return [COLUMNS.map(csvField).join(','), ...rows.map((row) => row.map(csvField).join(','))].join(
        '\n',
    );
}

function buildRow(
    row: SummarisedLeak,
    record: LeakRecord | undefined,
    settings: CalcSettings,
): (string | number)[] {
    const { result } = row;
    const preferredPower = preferredPowerEstimate(result);

    return [
        result.category === 'leak' ? 'Leak' : 'Open line',
        row.label,
        record?.repairStatus ?? '',
        rounded(record?.x, roundToInteger),
        rounded(record?.y, roundToInteger),
        rounded(result.equivalentDiameterMm?.low, (v) => roundToDecimals(v, 1)),
        rounded(result.equivalentDiameterMm?.expected, (v) => roundToDecimals(v, 1)),
        rounded(result.equivalentDiameterMm?.high, (v) => roundToDecimals(v, 1)),
        bandBasis(result, settings),
        preferredPower?.method ?? '',
        rounded(preferredPower?.powerKw?.low, (v) => roundToSignificantFigures(v, 3)),
        rounded(preferredPower?.powerKw?.expected, (v) => roundToSignificantFigures(v, 3)),
        rounded(preferredPower?.powerKw?.high, (v) => roundToSignificantFigures(v, 3)),
        rounded(result.annualEnergyKwh?.low, roundToInteger),
        rounded(result.annualEnergyKwh?.expected, roundToInteger),
        rounded(result.annualEnergyKwh?.high, roundToInteger),
        rounded(result.annualCostZar?.low, roundToInteger),
        rounded(result.annualCostZar?.expected, roundToInteger),
        rounded(result.annualCostZar?.high, roundToInteger),
        record?.loggedAt ?? '',
        record?.note ?? '',
    ];
}

/**
 * Which quantity the row's band comes from, and how wide it is — the two
 * catalogue-driven leak rows and the two open-line rows band a different
 * thing (see DECISIONS.md, 2026-09-08, "An open line is costed through the
 * same choked-orifice physics as a leak..."), and a bore that reads
 * identically at low/expected/high next to a spread-out power band is
 * otherwise unexplained.
 *
 * For a leak, the basis text also follows `diameterProvenance` (DECISIONS.md,
 * 2026-09-08, "A leak's band basis follows the provenance of the diameter
 * input..."): the band width is the same ±30% either way, but a measured
 * diameter and a catalogue-inferred one are different claims about where the
 * number came from, and labelling both "equivalent-diameter" would misstate
 * the measured row's provenance. Blank when there is no band to explain — an
 * unresolved or non-choked leak (`equivalentDiameterMm: null`).
 *
 * Exported so `RegisterScreen.tsx` can show the identical wording in the
 * diameter cell's tooltip, the same way it already shows `power.basis` in
 * the power cell's tooltip — one function here means the screen and the CSV
 * cannot drift apart on the wording.
 */
export function bandBasis(result: LeakResult, settings: CalcSettings): string {
    if (result.category !== 'leak') {
        return 'discharge-coefficient';
    }
    if (result.diameterProvenance === null) {
        return '';
    }

    const percent = Math.round(settings.diameterUncertaintyFraction * 100);
    return result.diameterProvenance === 'measured'
        ? `measured diameter, ±${percent}% assumed`
        : `catalogue equivalent diameter ±${percent}%`;
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

/** Applies `round` to `value` unless it is missing, in which case the cell is blank. */
function rounded(value: number | undefined, round: (value: number) => number): number | '' {
    return value === undefined ? '' : round(value);
}

function roundToInteger(value: number): number {
    return Math.round(value);
}

function roundToDecimals(value: number, decimals: number): number {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}

/**
 * Three significant figures on a power figure means three meaningful digits
 * regardless of magnitude — 1.37 kW and 137 kW are both "three sig figs",
 * unlike a fixed decimal count which would either truncate the first or pad
 * the second with false precision.
 */
function roundToSignificantFigures(value: number, significantFigures: number): number {
    if (value === 0) {
        return 0;
    }

    const magnitude = Math.floor(Math.log10(Math.abs(value)));
    const factor = 10 ** (significantFigures - 1 - magnitude);
    return Math.round(value * factor) / factor;
}

function csvField(value: string | number): string {
    const text = String(value);

    if (/[",\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }

    return text;
}
