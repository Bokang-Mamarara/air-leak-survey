/**
 * Shared colour coding for the leak/open-line distinction, used by both
 * LeakTypePicker (the grid) and MapScreen (the markers) so the same domain
 * signal reads consistently in both places. Not a calc-layer value — this is
 * display, not physics.
 */

export const LEAK_ACCENT_COLOR = '#e2574c'
export const OPEN_LINE_ACCENT_COLOR = '#3fa7d6'
export const PENDING_MARKER_COLOR = '#e8a33d'
