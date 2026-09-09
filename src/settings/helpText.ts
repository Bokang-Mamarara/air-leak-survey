/**
 * Help text shown under each settings field, hand-transcribed from the
 * source comment for the matching value in `src/calc/constants.ts`.
 *
 * This is a duplication, not a reference: TypeScript comments do not exist
 * at runtime, so the actual source-of-truth prose in `constants.ts` cannot
 * be imported here, and this file can drift from it if a constant's
 * reasoning changes and this file is not updated to match. The real fix is
 * exporting these strings as values from `constants.ts` itself, next to the
 * numbers they describe, the way `REALISED_SAVING_CAVEAT` already is — not
 * done today; logged in `DECISIONS.md`, 2026-09-09.
 */

export const HELP = {
  clearRecords:
    'Deletes every logged leak and open line from this device. Settings are not touched. There is no undo.',

  tariffIntro:
    'Time-of-use: peak, standard and off-peak, across a high and a low demand season. Mines run continuously, so a leak costs different amounts at different hours — a single blended rate understates continuously pressurised sections. Nothing here is applied until every rate, every hours figure, and a source are entered; until then the register shows "tariff not set", never R0.',
  tariffSource:
    'Which published tariff schedule this came from, and who entered it — shown next to every cost figure this tariff produces.',

  compressorSpecificPower:
    'The mine’s own compressor performance figure, kW per m³/s of free air delivered. Blank until a real figure is entered. Where present it beats the theoretical estimate below and the register says so.',
  compressorSource: 'Where the specific-power figure came from — a performance test, a datasheet, a commissioning report.',
  isentropicEfficiency:
    'Assumed efficiency for the theoretical method, used only when no site specific-power figure is entered. 0.75 is a stated assumption, not a measurement — pushing it down to see what moves is a reasonable first thing to try.',
  polytropicExponent:
    'The polytropic exponent n for a cooled compression path. 1.35 sits between isothermal (1.0) and isentropic for air (1.4) — what intercooling buys.',
  stageCount:
    'Compression stages assumed for the theoretical method, each taking an equal share of the total pressure ratio and intercooled back to inlet temperature.',
  compressorDischargePressure:
    'The compressor’s discharge pressure, used only by the theoretical power method to work out its compression ratio. Mine reticulation runs 400–500 kPa gauge; the upper end is the conservative default.',
  compressorInletTemperature:
    'Compressor intake temperature — the machine breathes surface air, so this can differ from the underground line temperature below.',

  sharpEdgedCoefficient:
    'Discharge coefficient for a sharp-edged opening — a puncture, a split, a blown coupling face, worn packing.',
  openLineCoefficient:
    'Discharge coefficient for a deliberately opened line. Treated as rounded/nozzle-like rather than an idealised fully-open bore, because a line opened by removing a blank, cracking a valve, or cutting a hose end discharges more raggedly than a clean bore. See DECISIONS.md, 2026-09-08.',

  linePressure:
    'Default line pressure feeding the choked-flow calculation for a leak, kPa gauge. Mine reticulation runs 400–500 kPa gauge; the upper end is the conservative default for a leak estimate. Overridable per logged leak.',
  airTemperature:
    'Line air temperature, °C. Reticulated air has been through aftercoolers and a long pipe run, so it sits near ambient rather than near discharge temperature.',
  operatingHours:
    'Hours per year a leak is pressurised. Mines run continuously, so the default is every hour of the year — reduce this for a section isolated between shifts.',
  diameterUncertainty:
    'Fractional half-width of the equivalent-diameter band, e.g. 0.3 for ±30%. This reflects a person choosing the closest catalogue description of what they heard, not a measured distribution. Flow goes with diameter squared, so ±30% on diameter becomes roughly −51% to +69% on flow.',

  atmosphericPressure:
    'Standard sea-level atmosphere, Pa. A working level on a deep-level mine sits well below sea level, where barometric pressure is materially higher — override this once a site figure is known.',
  openLineCoefficientUncertainty:
    'Fractional half-width banding the open-line discharge coefficient above, rather than its diameter (an open line’s bore is a measured nominal pipe size, not inferred). 0.25 spans an opened end from close to sharp-edged up to an idealised fully-open bore.',
} as const
