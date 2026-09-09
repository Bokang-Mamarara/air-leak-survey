import { describe, expect, it } from 'vitest';
import { DISCHARGE_COEFFICIENTS, LEAK_TYPE_CATALOGUE } from '../calc/constants.ts';
import {
    applyOpenLineCoefficient,
    applySharpEdgedCoefficient,
    currentOpenLineCoefficient,
    currentSharpEdgedCoefficient,
    openLineGroupLabels,
    sharpEdgedExcludedLeakLabels,
    sharpEdgedGroupLabels,
} from './dischargeCoefficientGroups.ts';

describe('sharpEdgedGroupLabels', () => {
    it('names the five sharp-edged leak types, not the rounded one', () => {
        const labels = sharpEdgedGroupLabels(LEAK_TYPE_CATALOGUE);

        expect(labels).toContain('Pinhole in hose');
        expect(labels).toContain('Failed hose coupling');
        expect(labels).toContain('Valve gland / packing');
        expect(labels).toContain('Damaged flexible hose');
        expect(labels).toContain('Drill rig connection');
        expect(labels).not.toContain('Missing blank / open branch');
        expect(labels).toHaveLength(5);
    });
});

describe('sharpEdgedExcludedLeakLabels', () => {
    it('names the leak entries the sharp-edged control does not touch', () => {
        expect(sharpEdgedExcludedLeakLabels(LEAK_TYPE_CATALOGUE)).toEqual([
            'Missing blank / open branch',
        ]);
    });
});

describe('openLineGroupLabels', () => {
    it('names both deliberate-open-line entries', () => {
        const labels = openLineGroupLabels(LEAK_TYPE_CATALOGUE);

        expect(labels).toEqual(
            expect.arrayContaining(['Refuge bay self-ventilation', 'Open line for cooling']),
        );
        expect(labels).toHaveLength(2);
    });
});

describe('currentSharpEdgedCoefficient / currentOpenLineCoefficient', () => {
    it('read the catalogue defaults before any override', () => {
        expect(currentSharpEdgedCoefficient(LEAK_TYPE_CATALOGUE)).toBe(
            DISCHARGE_COEFFICIENTS.sharpEdged,
        );
        expect(currentOpenLineCoefficient(LEAK_TYPE_CATALOGUE)).toBe(
            DISCHARGE_COEFFICIENTS.rounded,
        );
    });
});

describe('applySharpEdgedCoefficient', () => {
    it('changes every sharp-edged entry and leaves everything else untouched', () => {
        const next = applySharpEdgedCoefficient(LEAK_TYPE_CATALOGUE, 0.55);

        for (const label of sharpEdgedGroupLabels(LEAK_TYPE_CATALOGUE)) {
            const entry = next.find((type) => type.label === label)!;
            expect(entry.dischargeCoefficient).toBe(0.55);
        }

        const missingBlank = next.find((type) => type.id === 'missing-blank-open-branch')!;
        expect(missingBlank.dischargeCoefficient).toBe(DISCHARGE_COEFFICIENTS.rounded);

        const openLine = next.find((type) => type.id === 'refuge-bay-self-ventilation')!;
        expect(openLine.dischargeCoefficient).toBe(DISCHARGE_COEFFICIENTS.rounded);
    });

    it('keeps working correctly after a second, different edit', () => {
        const first = applySharpEdgedCoefficient(LEAK_TYPE_CATALOGUE, 0.55);
        const second = applySharpEdgedCoefficient(first, 0.7);

        for (const label of sharpEdgedGroupLabels(LEAK_TYPE_CATALOGUE)) {
            const entry = second.find((type) => type.label === label)!;
            expect(entry.dischargeCoefficient).toBe(0.7);
        }
    });
});

describe('applyOpenLineCoefficient', () => {
    it('changes both open-line entries and leaves leaks untouched', () => {
        const next = applyOpenLineCoefficient(LEAK_TYPE_CATALOGUE, 0.9);

        for (const label of openLineGroupLabels(LEAK_TYPE_CATALOGUE)) {
            const entry = next.find((type) => type.label === label)!;
            expect(entry.dischargeCoefficient).toBe(0.9);
        }

        const coupling = next.find((type) => type.id === 'failed-hose-coupling')!;
        expect(coupling.dischargeCoefficient).toBe(DISCHARGE_COEFFICIENTS.sharpEdged);
    });
});
