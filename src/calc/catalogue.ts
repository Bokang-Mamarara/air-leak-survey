/**
 * Looks up one entry from a leak-type catalogue by id.
 *
 * Pulled out of `evaluateLeak.ts` so that `openLine.ts` and `evaluateLeak.ts`
 * can both use it without either importing the other or importing `index.ts`
 * — `index.ts` re-exports `summariseLeaks`, which itself calls both of them,
 * so importing "the entry point" from inside either would be circular.
 */

import type { LeakTypeDefinition } from './types.ts';

export function findLeakType(
    leakTypeId: string,
    catalogue: readonly LeakTypeDefinition[],
): LeakTypeDefinition {
    const leakType = catalogue.find((type) => type.id === leakTypeId);

    if (leakType === undefined) {
        throw new RangeError(
            `Unknown leak type "${leakTypeId}". The catalogue holds: ` +
                `${catalogue.map((type) => type.id).join(', ')}.`,
        );
    }

    return leakType;
}
