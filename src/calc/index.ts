/**
 * The public entry point of the calculation layer. This file holds no logic
 * of its own — every function below is defined in its own leaf module and
 * re-exported here, so that a consumer only ever writes `from '../calc/index.ts'`
 * and the module graph inside `src/calc/` stays acyclic (see DECISIONS.md,
 * Phase 5, for why that matters: `summarise.ts` calls both `evaluateLeak` and
 * `evaluateOpenLine`, and if either of those were defined in this file, this
 * file re-exporting `summariseLeaks` would create an import cycle).
 *
 *     evaluateLeak(input, settings)      -> LeakResult for one logged leak
 *     evaluateOpenLine(input, settings)  -> LeakResult for one deliberate open line
 *     summariseLeaks(records, settings)  -> LeakSummary: ranked leaks, ranked
 *                                            open lines, two separate totals,
 *                                            loss by type
 *
 * Nothing in `src/calc` imports React, reads storage, calls the network or
 * asks for the time. Every function here takes inputs and returns outputs.
 */

export {
    DEFAULT_CALC_SETTINGS,
    OPEN_LINE_DISCHARGE_COEFFICIENT,
    OPEN_LINE_DISCHARGE_COEFFICIENT_UNCERTAINTY_FRACTION,
    REALISED_SAVING_CAVEAT,
} from './constants.ts';
export type {
    CalcSettings,
    CompressorPowerEstimate,
    CompressorSpec,
    LeakCategory,
    LeakInput,
    LeakResult,
    LeakTypeDefinition,
    Range,
    TariffSchedule,
} from './types.ts';

export { evaluateLeak } from './evaluateLeak.ts';

export { evaluateOpenLine } from './openLine.ts';
export type { OpenLineInput } from './openLine.ts';

export { summariseLeaks } from './summarise.ts';
export type {
    CategoryTotals,
    LeakSummary,
    LeakTypeLoss,
    LoggedLeak,
    SummarisedLeak,
} from './summarise.ts';
