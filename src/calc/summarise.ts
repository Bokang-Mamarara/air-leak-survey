/**
 * `summariseLeaks` — turns a set of stored records into the leak register:
 * ranked leaks, a separate ranked list of open lines, two independent
 * totals, and a per-type breakdown for the chart.
 *
 * This is the deferred-from-Phase-1 function `evaluateLeak`'s own docstring
 * pointed at: totalling belongs in the calculation layer because keeping a
 * deliberate open line out of the leak total is a domain rule, not a display
 * choice. The dispatch below is that rule made concrete — which model a
 * record runs through is decided here, from the catalogue's own category,
 * never from a stored boolean the caller could get wrong.
 *
 * Takes plain data, not a Dexie `LeakRecord` — this folder does not import
 * Dexie. `LoggedLeak` is the calc-relevant subset a caller (the register
 * screen) maps its stored records onto.
 */

import { findLeakType } from './catalogue.ts';
import { evaluateLeak } from './evaluateLeak.ts';
import { evaluateOpenLine } from './openLine.ts';
import type { CalcSettings, LeakCategory, LeakResult, Range } from './types.ts';

export interface LoggedLeak {
    id: string;
    leakTypeId: string;
    /**
     * As stored: an orifice equivalent for a leak, a real nominal bore for an
     * open line. Which pipeline this runs through is decided by the
     * catalogue's category for `leakTypeId`, not by this field — see the
     * module doc above.
     */
    equivalentDiameterMm: number;
    linePressureKpaG: number;
}

export interface SummarisedLeak {
    id: string;
    leakTypeId: string;
    label: string;
    result: LeakResult;
}

/**
 * `annualCostZar` is `null`, with `costUnavailableReason` set, whenever no
 * tariff is entered — never a fabricated zero. A category with no logged
 * records still gets a real `{0, 0, 0}` band: that total is genuinely zero,
 * which is a different statement from "unknown".
 */
export interface CategoryTotals {
    count: number;
    annualEnergyKwh: Range;
    annualCostZar: Range | null;
    costUnavailableReason: 'no-tariff-set' | null;
}

export interface LeakTypeLoss {
    leakTypeId: string;
    label: string;
    category: LeakCategory;
    count: number;
    annualEnergyKwh: Range;
    annualCostZar: Range | null;
}

/**
 * Two named buckets, no third. There is nowhere to put a figure that sums
 * leaks and open lines together — the same shape of guarantee
 * `LeakResult.power` gives the two compressor methods.
 */
export interface LeakSummary {
    leaks: SummarisedLeak[];
    openLines: SummarisedLeak[];
    leakTotals: CategoryTotals;
    openLineTotals: CategoryTotals;
    byLeakType: LeakTypeLoss[];
}

export function summariseLeaks(
    records: readonly LoggedLeak[],
    settings: CalcSettings,
): LeakSummary {
    const evaluated = records.map((record) => evaluateRecord(record, settings));

    const leaks = evaluated
        .filter((row) => row.result.category === 'leak')
        .sort(compareByLossDescending);
    const openLines = evaluated
        .filter((row) => row.result.category === 'deliberate-open-line')
        .sort(compareByLossDescending);

    const tariffIsSet = settings.tariff !== null;

    return {
        leaks,
        openLines,
        leakTotals: totalsFor(leaks, tariffIsSet),
        openLineTotals: totalsFor(openLines, tariffIsSet),
        byLeakType: groupByLeakType(evaluated, tariffIsSet),
    };
}

function evaluateRecord(record: LoggedLeak, settings: CalcSettings): SummarisedLeak {
    const leakType = findLeakType(record.leakTypeId, settings.leakTypes);

    const result =
        leakType.category === 'leak'
            ? evaluateLeak(
                  {
                      leakTypeId: record.leakTypeId,
                      equivalentDiameterMm: record.equivalentDiameterMm,
                      linePressureKpaG: record.linePressureKpaG,
                  },
                  settings,
              )
            : evaluateOpenLine(
                  {
                      leakTypeId: record.leakTypeId,
                      boreMm: record.equivalentDiameterMm,
                      linePressureKpaG: record.linePressureKpaG,
                  },
                  settings,
              );

    return { id: record.id, leakTypeId: record.leakTypeId, label: leakType.label, result };
}

/**
 * Worst loss first. Cost when it can be known; energy when it cannot, so an
 * unset tariff does not collapse the ranking to input order. A record with
 * neither (an unchoked line) sinks to the bottom rather than the top.
 */
function compareByLossDescending(a: SummarisedLeak, b: SummarisedLeak): number {
    const valueOf = (row: SummarisedLeak) =>
        row.result.annualCostZar?.expected ?? row.result.annualEnergyKwh?.expected ?? -Infinity;

    return valueOf(b) - valueOf(a);
}

function totalsFor(rows: readonly SummarisedLeak[], tariffIsSet: boolean): CategoryTotals {
    const { annualEnergyKwh, annualCostZar } = sumEnergyAndCost(rows, tariffIsSet);

    return {
        count: rows.length,
        annualEnergyKwh,
        annualCostZar,
        costUnavailableReason: tariffIsSet ? null : 'no-tariff-set',
    };
}

function groupByLeakType(
    rows: readonly SummarisedLeak[],
    tariffIsSet: boolean,
): LeakTypeLoss[] {
    const byType = new Map<string, SummarisedLeak[]>();

    for (const row of rows) {
        const group = byType.get(row.leakTypeId) ?? [];
        group.push(row);
        byType.set(row.leakTypeId, group);
    }

    return Array.from(byType.entries()).map(([leakTypeId, group]) => {
        const { annualEnergyKwh, annualCostZar } = sumEnergyAndCost(group, tariffIsSet);

        return {
            leakTypeId,
            label: group[0].label,
            category: group[0].result.category,
            count: group.length,
            annualEnergyKwh,
            annualCostZar,
        };
    });
}

/**
 * A row whose flow could not be resolved (an unchoked line) contributes
 * nothing to a sum rather than blocking it — this is a portfolio total, not
 * a single propagated band, so one bad input degrades it rather than voiding
 * it. Cost is null across the board only when the tariff itself is unset.
 */
function sumEnergyAndCost(
    rows: readonly SummarisedLeak[],
    tariffIsSet: boolean,
): { annualEnergyKwh: Range; annualCostZar: Range | null } {
    const energyRanges = rows
        .map((row) => row.result.annualEnergyKwh)
        .filter((range): range is Range => range !== null);
    const costRanges = rows
        .map((row) => row.result.annualCostZar)
        .filter((range): range is Range => range !== null);

    return {
        annualEnergyKwh: sumRanges(energyRanges),
        annualCostZar: tariffIsSet ? sumRanges(costRanges) : null,
    };
}

function sumRanges(ranges: readonly Range[]): Range {
    return ranges.reduce(
        (total, range) => ({
            low: total.low + range.low,
            expected: total.expected + range.expected,
            high: total.high + range.high,
        }),
        { low: 0, expected: 0, high: 0 },
    );
}
