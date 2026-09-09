/**
 * Which catalogue entries move when the settings screen's two discharge-
 * coefficient controls change.
 *
 * `LeakTypeDefinition` carries one coefficient per entry, not a group tag, so
 * "the sharp-edged group" and "the open-line group" are derived here from the
 * shipped `LEAK_TYPE_CATALOGUE` — never from a live `leakTypes` array — and
 * membership is fixed once, at module load. Deriving it from the live array
 * instead would break after the first edit: once a coefficient has been
 * changed away from `DISCHARGE_COEFFICIENTS.sharpEdged`, matching against
 * that constant would no longer find the entries that used to hold it.
 *
 * `missing-blank-open-branch` is a leak that discharges like a machined bore
 * (`DISCHARGE_COEFFICIENTS.rounded`), not a torn or sharp edge. It is
 * deliberately excluded from both groups: it is a different physical case,
 * not the sharp-edged assumption being tuned, and folding it into either
 * control would silently change a coefficient the settings screen never told
 * the user it would touch.
 */

import { DISCHARGE_COEFFICIENTS, LEAK_TYPE_CATALOGUE } from '../calc/constants.ts';
import type { LeakTypeDefinition } from '../calc/types.ts';

const SHARP_EDGED_GROUP_IDS = new Set(
    LEAK_TYPE_CATALOGUE.filter(
        (type) =>
            type.category === 'leak' &&
            type.dischargeCoefficient === DISCHARGE_COEFFICIENTS.sharpEdged,
    ).map((type) => type.id),
);

const OPEN_LINE_GROUP_IDS = new Set(
    LEAK_TYPE_CATALOGUE.filter((type) => type.category === 'deliberate-open-line').map(
        (type) => type.id,
    ),
);

function labelsFor(
    leakTypes: readonly LeakTypeDefinition[],
    ids: Set<string>,
): string[] {
    return leakTypes.filter((type) => ids.has(type.id)).map((type) => type.label);
}

/** Catalogue labels the sharp-edged control affects, in the given leakTypes array. */
export function sharpEdgedGroupLabels(leakTypes: readonly LeakTypeDefinition[]): string[] {
    return labelsFor(leakTypes, SHARP_EDGED_GROUP_IDS);
}

/** Catalogue labels the open-line control affects, in the given leakTypes array. */
export function openLineGroupLabels(leakTypes: readonly LeakTypeDefinition[]): string[] {
    return labelsFor(leakTypes, OPEN_LINE_GROUP_IDS);
}

/**
 * Leak-category entries the sharp-edged control does not touch — today just
 * `missing-blank-open-branch`, computed rather than named so this stays
 * correct if the catalogue changes.
 */
export function sharpEdgedExcludedLeakLabels(
    leakTypes: readonly LeakTypeDefinition[],
): string[] {
    return leakTypes
        .filter((type) => type.category === 'leak' && !SHARP_EDGED_GROUP_IDS.has(type.id))
        .map((type) => type.label);
}

/** The sharp-edged group's current coefficient, read off its first member. */
export function currentSharpEdgedCoefficient(
    leakTypes: readonly LeakTypeDefinition[],
): number | null {
    const entry = leakTypes.find((type) => SHARP_EDGED_GROUP_IDS.has(type.id));
    return entry ? entry.dischargeCoefficient : null;
}

/** The open-line group's current coefficient, read off its first member. */
export function currentOpenLineCoefficient(
    leakTypes: readonly LeakTypeDefinition[],
): number | null {
    const entry = leakTypes.find((type) => OPEN_LINE_GROUP_IDS.has(type.id));
    return entry ? entry.dischargeCoefficient : null;
}

/** Applies `coefficient` to every entry in the sharp-edged group, leaving the rest unchanged. */
export function applySharpEdgedCoefficient(
    leakTypes: readonly LeakTypeDefinition[],
    coefficient: number,
): LeakTypeDefinition[] {
    return leakTypes.map((type) =>
        SHARP_EDGED_GROUP_IDS.has(type.id) ? { ...type, dischargeCoefficient: coefficient } : type,
    );
}

/** Applies `coefficient` to every entry in the open-line group, leaving the rest unchanged. */
export function applyOpenLineCoefficient(
    leakTypes: readonly LeakTypeDefinition[],
    coefficient: number,
): LeakTypeDefinition[] {
    return leakTypes.map((type) =>
        OPEN_LINE_GROUP_IDS.has(type.id) ? { ...type, dischargeCoefficient: coefficient } : type,
    );
}
