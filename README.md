# README.md

Under construction — Day 7 (`PLAN.md`). Sections are being written as their
content is ready rather than all at once at the end; this file does not yet
have all eight.

---

## 7. What real mine data would be needed to trust the output

The tool runs on stated assumptions wherever a real, site-specific figure
isn't available (rule 3, `CLAUDE.md`). Trusting the output for an actual
mine means replacing each of the following with the real thing:

### Tariff

The tariff is deliberately unset. Compressed air leak costing needs the
site's own Megaflex rates, which are not a single national figure:

- Eskom Schedule of Standard Prices, Table 1 (Megaflex non-local
  authority), effective 1 April 2026 to 31 March 2027
- Rates are seasonally and time-of-use differentiated and depend on the
  voltage of supply and the Transmission zone, so the correct six rates
  are specific to the mine's point of delivery
- High-demand season is 1 June to 31 August; low-demand season is
  1 September to 31 May
- Published rates include VAT at 15%; the schedule also shows excl-VAT
  rates, and which applies depends on the site's VAT treatment
- Megaflex applies above an NMD of 1 MVA, which a deep-level mine exceeds

The tool therefore reports energy in kWh/yr with no cost figure until a
site tariff is entered, rather than defaulting to a national average that
would be wrong for every specific mine.

### Compressor performance

*Pending.*

### Actual line pressures

*Pending.*

### Level plans

*Pending.*
