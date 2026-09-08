import { describe, expect, it } from 'vitest';

import { DEFAULT_CALC_SETTINGS, summariseLeaks, type LoggedLeak } from '../calc/index.ts';
import type { LeakRecord } from '../data/db.ts';
import { buildCsv } from './csv.ts';

const coupling: LoggedLeak = {
    id: 'leak-1',
    leakTypeId: 'failed-hose-coupling',
    equivalentDiameterMm: 3,
    linePressureKpaG: 500,
};

const refugeBay: LoggedLeak = {
    id: 'open-1',
    leakTypeId: 'refuge-bay-self-ventilation',
    equivalentDiameterMm: 25,
    linePressureKpaG: 500,
};

function fakeRecord(overrides: Partial<LeakRecord> & { id: string }): LeakRecord {
    return {
        levelId: 'level-24',
        x: 10,
        y: 20,
        leakTypeId: 'failed-hose-coupling',
        equivalentDiameterMm: 3,
        linePressureKpaG: 500,
        isDeliberateOpenLine: false,
        loggedAt: '2026-09-08T12:00:00.000Z',
        loggedBy: 'device-abc',
        syncStatus: 'pending',
        repairStatus: 'open',
        ...overrides,
    };
}

describe('buildCsv', () => {
    it('gives ranges as separate low/expected/high numeric columns, not a combined string', () => {
        const summary = summariseLeaks([coupling], DEFAULT_CALC_SETTINGS);
        const recordsById = new Map([[coupling.id, fakeRecord({ id: coupling.id })]]);

        const csv = buildCsv(summary, recordsById);
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
                    isDeliberateOpenLine: true,
                }),
            ],
        ]);

        const csv = buildCsv(summary, recordsById);
        const lines = csv.trim().split('\n');

        expect(lines).toHaveLength(3); // header + 2 rows
        expect(lines.some((line) => line.includes('Leak'))).toBe(true);
        expect(lines.some((line) => line.includes('Open line'))).toBe(true);
    });

    it('leaves cost cells blank rather than writing R0 when no tariff is set', () => {
        const summary = summariseLeaks([coupling], DEFAULT_CALC_SETTINGS);
        const recordsById = new Map([[coupling.id, fakeRecord({ id: coupling.id })]]);

        const csv = buildCsv(summary, recordsById);
        const [header, row] = csv.trim().split('\n');
        const costIndex = header.split(',').indexOf('Cost expected (R/yr)');

        expect(row.split(',')[costIndex]).toBe('');
    });

    it('escapes a comma in a note field', () => {
        const summary = summariseLeaks([coupling], DEFAULT_CALC_SETTINGS);
        const recordsById = new Map([
            [coupling.id, fakeRecord({ id: coupling.id, note: 'near split set, drive 3' })],
        ]);

        const csv = buildCsv(summary, recordsById);

        expect(csv).toContain('"near split set, drive 3"');
    });
});
