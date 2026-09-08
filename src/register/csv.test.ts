import { describe, expect, it } from 'vitest';

import { DEFAULT_CALC_SETTINGS, summariseLeaks, type LoggedLeak } from '../calc/index.ts';
import type { LeakRecord } from '../data/db.ts';
import { buildCsv } from './csv.ts';

const coupling: LoggedLeak = {
    id: 'leak-1',
    leakTypeId: 'failed-hose-coupling',
    equivalentDiameterMm: 3,
    diameterProvenance: 'catalogue',
    linePressureKpaG: 500,
};

/** Same leak type and diameter as `coupling`, but as a measured override
 * rather than the untouched catalogue default — same value, different
 * provenance, for the band-basis wording test. */
const measuredCoupling: LoggedLeak = {
    id: 'leak-3',
    leakTypeId: 'failed-hose-coupling',
    equivalentDiameterMm: 3,
    diameterProvenance: 'measured',
    linePressureKpaG: 500,
};

/** 6 mm nominal ±30% is the textbook case where `6 * 0.7`/`6 * 1.3` land on
 * floating-point noise (4.199999999999999 / 7.800000000000001) rather than
 * the intended 4.2 / 7.8. */
const damagedHose: LoggedLeak = {
    id: 'leak-2',
    leakTypeId: 'damaged-flexible-hose',
    equivalentDiameterMm: 6,
    diameterProvenance: 'catalogue',
    linePressureKpaG: 500,
};

const refugeBay: LoggedLeak = {
    id: 'open-1',
    leakTypeId: 'refuge-bay-self-ventilation',
    equivalentDiameterMm: 25,
    diameterProvenance: 'measured', // open lines have no catalogue default
    linePressureKpaG: 500,
};

/** Same fictional schedule used elsewhere in the calc test suite — needed here
 * only to give the precision test a real, non-null cost figure to round. */
const TEST_TARIFF = {
    currency: 'ZAR' as const,
    ratesZarPerKwh: {
        highDemandSeason: { peak: 6.0, standard: 1.9, offPeak: 1.05 },
        lowDemandSeason: { peak: 2.1, standard: 1.45, offPeak: 0.92 },
    },
    hoursPerYear: {
        highDemandSeason: { peak: 400, standard: 800, offPeak: 1008 },
        lowDemandSeason: { peak: 1100, standard: 2400, offPeak: 3052 },
    },
    source: 'Fictional schedule, csv.test.ts fixture',
};

function fakeRecord(overrides: Partial<LeakRecord> & { id: string }): LeakRecord {
    return {
        levelId: 'level-24',
        x: 10,
        y: 20,
        leakTypeId: 'failed-hose-coupling',
        equivalentDiameterMm: 3,
        diameterProvenance: 'catalogue',
        linePressureKpaG: 500,
        isDeliberateOpenLine: false,
        loggedAt: '2026-09-08T12:00:00.000Z',
        loggedBy: 'device-abc',
        syncStatus: 'pending',
        repairStatus: 'open',
        ...overrides,
    };
}

/** Splits one CSV line into fields, honouring `csvField`'s quoting — a naive
 * `line.split(',')` misaligns every column once a cell (e.g. a "measured
 * diameter, ±30% assumed" band basis) is quoted because it contains a comma. */
function parseCsvRow(line: string): string[] {
    const fields: string[] = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (inQuotes) {
            if (char === '"' && line[i + 1] === '"') {
                field += '"';
                i++;
            } else if (char === '"') {
                inQuotes = false;
            } else {
                field += char;
            }
        } else if (char === '"') {
            inQuotes = true;
        } else if (char === ',') {
            fields.push(field);
            field = '';
        } else {
            field += char;
        }
    }
    fields.push(field);

    return fields;
}

/** Cell value at a named column, for a given data row (0-indexed, header excluded). */
function cellAt(csv: string, column: string, rowIndex = 0): string {
    const lines = csv.trim().split('\n');
    const columnIndex = parseCsvRow(lines[0]).indexOf(column);
    if (columnIndex === -1) {
        throw new Error(`No "${column}" column in header: ${lines[0]}`);
    }
    return parseCsvRow(lines[rowIndex + 1])[columnIndex];
}

/** Digits in a number's text, ignoring sign, decimal point and leading zeros —
 * i.e. its count of significant figures as written. */
function significantDigitCount(text: string): number {
    const digitsOnly = text.replace(/^-/, '').replace('.', '');
    const firstNonZero = digitsOnly.search(/[1-9]/);
    return firstNonZero === -1 ? 0 : digitsOnly.slice(firstNonZero).length;
}

describe('buildCsv', () => {
    it('gives ranges as separate low/expected/high numeric columns, not a combined string', () => {
        const summary = summariseLeaks([coupling], DEFAULT_CALC_SETTINGS);
        const recordsById = new Map([[coupling.id, fakeRecord({ id: coupling.id })]]);

        const csv = buildCsv(summary, recordsById, DEFAULT_CALC_SETTINGS);
        const [header, row] = csv.trim().split('\n');

        expect(header).not.toContain('1.5-3.2');
        expect(header.split(',')).toContain('Diameter/bore low (mm)');
        expect(header.split(',')).toContain('Diameter/bore high (mm)');
        // A single cell must never look like "2.1-3.9" (Excel would read a
        // range-shaped string like that as a date).
        expect(row).not.toMatch(/\d+\.\d+-\d+\.\d+/);
    });

    it('includes both leaks and open lines, distinguished by a Category column', () => {
        const summary = summariseLeaks([coupling, refugeBay], DEFAULT_CALC_SETTINGS);
        const recordsById = new Map([
            [coupling.id, fakeRecord({ id: coupling.id })],
            [
                refugeBay.id,
                fakeRecord({
                    id: refugeBay.id,
                    leakTypeId: 'refuge-bay-self-ventilation',
                    equivalentDiameterMm: 25,
                    diameterProvenance: 'measured',
                    isDeliberateOpenLine: true,
                }),
            ],
        ]);

        const csv = buildCsv(summary, recordsById, DEFAULT_CALC_SETTINGS);
        const lines = csv.trim().split('\n');

        expect(lines).toHaveLength(3); // header + 2 rows
        expect(lines.some((line) => line.includes('Leak'))).toBe(true);
        expect(lines.some((line) => line.includes('Open line'))).toBe(true);
    });

    it('leaves cost cells blank rather than writing R0 when no tariff is set', () => {
        const summary = summariseLeaks([coupling], DEFAULT_CALC_SETTINGS);
        const recordsById = new Map([[coupling.id, fakeRecord({ id: coupling.id })]]);

        const csv = buildCsv(summary, recordsById, DEFAULT_CALC_SETTINGS);

        expect(cellAt(csv, 'Cost expected (R/yr)')).toBe('');
    });

    it('escapes a comma in a note field', () => {
        const summary = summariseLeaks([coupling], DEFAULT_CALC_SETTINGS);
        const recordsById = new Map([
            [coupling.id, fakeRecord({ id: coupling.id, note: 'near split set, drive 3' })],
        ]);

        const csv = buildCsv(summary, recordsById, DEFAULT_CALC_SETTINGS);

        expect(csv).toContain('"near split set, drive 3"');
    });

    it('rounds the logged position to a whole pixel', () => {
        const summary = summariseLeaks([coupling], DEFAULT_CALC_SETTINGS);
        const recordsById = new Map([
            [coupling.id, fakeRecord({ id: coupling.id, x: 10.6, y: 19.4 })],
        ]);

        const csv = buildCsv(summary, recordsById, DEFAULT_CALC_SETTINGS);

        expect(cellAt(csv, 'Position x (px)')).toBe('11');
        expect(cellAt(csv, 'Position y (px)')).toBe('19');
    });

    it('rounds the diameter band to one decimal, clearing the floating-point noise underneath', () => {
        // 6 * 0.7 and 6 * 1.3 are 4.199999999999999 and 7.800000000000001 in
        // floating point (see the fixture comment above) — the calculation
        // itself is left alone (DECISIONS.md, "Floating point is left alone
        // inside the calculation"); only the exported cell is rounded.
        const summary = summariseLeaks([damagedHose], DEFAULT_CALC_SETTINGS);
        const rawLow = summary.leaks[0].result.equivalentDiameterMm?.low;
        const rawHigh = summary.leaks[0].result.equivalentDiameterMm?.high;
        expect(rawLow).toBe(4.199999999999999);
        expect(rawHigh).toBe(7.800000000000001);

        const recordsById = new Map([
            [
                damagedHose.id,
                fakeRecord({
                    id: damagedHose.id,
                    leakTypeId: 'damaged-flexible-hose',
                    equivalentDiameterMm: 6,
                }),
            ],
        ]);

        const csv = buildCsv(summary, recordsById, DEFAULT_CALC_SETTINGS);

        expect(cellAt(csv, 'Diameter/bore low (mm)')).toBe('4.2');
        expect(cellAt(csv, 'Diameter/bore high (mm)')).toBe('7.8');
    });

    it('does not export more precision than the input supports: three significant figures on power, whole numbers on energy and cost', () => {
        const settings = { ...DEFAULT_CALC_SETTINGS, tariff: TEST_TARIFF };
        const summary = summariseLeaks([coupling], settings);
        const result = summary.leaks[0].result;

        // Sanity check first: the raw calculation really does carry far more
        // precision than three significant figures, so this test would fail
        // if the rounding step were ever removed.
        const rawPower = result.power.theoretical.powerKw?.expected as number;
        const rawEnergy = result.annualEnergyKwh?.expected as number;
        const rawCost = result.annualCostZar?.expected as number;
        expect(significantDigitCount(String(rawPower))).toBeGreaterThan(3);
        expect(Number.isInteger(rawEnergy)).toBe(false);
        expect(Number.isInteger(rawCost)).toBe(false);

        const recordsById = new Map([[coupling.id, fakeRecord({ id: coupling.id })]]);
        const csv = buildCsv(summary, recordsById, settings);

        const exportedPower = cellAt(csv, 'Power expected (kW)');
        const exportedEnergy = cellAt(csv, 'Energy expected (kWh/yr)');
        const exportedCost = cellAt(csv, 'Cost expected (R/yr)');

        expect(significantDigitCount(exportedPower)).toBeLessThanOrEqual(3);
        expect(Number(exportedPower)).toBeCloseTo(1.37, 2);
        expect(exportedEnergy).toBe(String(Math.round(rawEnergy)));
        expect(exportedCost).toBe(String(Math.round(rawCost)));
    });

    it('labels the band basis by provenance: catalogue default, measured override, and discharge coefficient for an open line', () => {
        const summary = summariseLeaks([coupling, measuredCoupling, refugeBay], DEFAULT_CALC_SETTINGS);
        const recordsById = new Map([
            [coupling.id, fakeRecord({ id: coupling.id })],
            [
                measuredCoupling.id,
                fakeRecord({ id: measuredCoupling.id, diameterProvenance: 'measured' }),
            ],
            [
                refugeBay.id,
                fakeRecord({
                    id: refugeBay.id,
                    leakTypeId: 'refuge-bay-self-ventilation',
                    equivalentDiameterMm: 25,
                    diameterProvenance: 'measured',
                    isDeliberateOpenLine: true,
                }),
            ],
        ]);

        const csv = buildCsv(summary, recordsById, DEFAULT_CALC_SETTINGS);
        const [header, ...dataRows] = csv.trim().split('\n');
        const basisIndex = parseCsvRow(header).indexOf('Band basis');

        // coupling and measuredCoupling share a label and value (same numbers,
        // different provenance — the point of the test), so the two leak rows
        // are told apart by which basis wording they carry, not by identity.
        const leakBases = dataRows
            .filter((line) => line.startsWith('Leak,'))
            .map((line) => parseCsvRow(line)[basisIndex]);
        const openLineRow = dataRows.find((line) => line.startsWith('Open line,'));

        expect(leakBases).toContain('catalogue equivalent diameter ±30%');
        expect(leakBases).toContain('measured diameter, ±30% assumed');
        expect(parseCsvRow(openLineRow ?? '')[basisIndex]).toBe('discharge-coefficient');
    });
});
