/**
 * Groups and looks up entries from LEAK_TYPE_CATALOGUE for the capture flow.
 *
 * The catalogue itself already lives in src/calc/constants.ts, typed as
 * LeakTypeDefinition (src/calc/types.ts) — there is no second copy here. This
 * file only splits it by category, which is what LeakTypePicker needs to
 * render the two open-line entries as a visually separate group.
 */

import { LEAK_TYPE_CATALOGUE } from '../calc/constants.ts'
import type { LeakTypeDefinition } from '../calc/types.ts'

export const LEAK_TYPES: readonly LeakTypeDefinition[] = LEAK_TYPE_CATALOGUE.filter(
  (type) => type.category === 'leak',
)

export const OPEN_LINE_TYPES: readonly LeakTypeDefinition[] = LEAK_TYPE_CATALOGUE.filter(
  (type) => type.category === 'deliberate-open-line',
)

export function getLeakType(id: string): LeakTypeDefinition {
  const found = LEAK_TYPE_CATALOGUE.find((type) => type.id === id)

  if (!found) {
    throw new RangeError(
      `Unknown leak type "${id}". The catalogue holds: ` +
        `${LEAK_TYPE_CATALOGUE.map((type) => type.id).join(', ')}.`,
    )
  }

  return found
}
