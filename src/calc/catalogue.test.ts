import { describe, expect, it } from 'vitest';

import { LEAK_TYPE_CATALOGUE } from './constants.ts';
import { findLeakType } from './catalogue.ts';

describe('findLeakType', () => {
    it('finds an entry by id', () => {
        const found = findLeakType('failed-hose-coupling', LEAK_TYPE_CATALOGUE);

        expect(found.id).toBe('failed-hose-coupling');
        expect(found.equivalentDiameterMm).toBe(3);
    });

    it('throws, naming the unknown id, when the id is not in the catalogue', () => {
        expect(() => findLeakType('ruptured-manifold', LEAK_TYPE_CATALOGUE)).toThrow(
            /ruptured-manifold/,
        );
    });

    it('names the ids that would have worked', () => {
        expect(() => findLeakType('ruptured-manifold', LEAK_TYPE_CATALOGUE)).toThrow(
            /failed-hose-coupling/,
        );
    });
});
