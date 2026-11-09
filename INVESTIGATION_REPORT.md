# PrintMetric — Product & Technical Investigation

**Scope:** Read-only review of the supplied checkout at `C:\Users\theoc\Documents\projects\printmetric-main`. Source behavior is labeled **VERIFIED**; README and changelog statements not demonstrated in runtime are **DOCUMENTED**. No source or configuration was changed.

## 1. Executive Summary

**VERIFIED:** PrintMetric is a dependency-free, static browser application for estimating the cost and selling price of 3D-printed orders. It combines filament, electricity, flat machine wear, setup and per-unit labor, a percentage waste allowance, markup, quantity, a minimum order price, manual EUR-to-USD conversion, named local profiles, G-code metadata import, and a print-to-PDF customer quote.

The calculation module is separated cleanly from the DOM and has unusually broad tests for a small vanilla-JS tool. The main formula is internally consistent with the documented definition of markup (percentage added to cost), quantity, setup labor, allowance, and order-level minimum. The important product limitation is that it is a configurable estimate, not a measured cost-accounting system: printer wattage, density, wear, labor, and waste often need user calibration, and print time is not multiplied by quantity in the electricity calculation (it is assumed to be per unit, as documented).

The largest immediate concerns are a full test suite failure because the checked-in CI workflow is missing, a checkout without Git metadata that prevents comparing exact revisions, no portable backup/export for local data, and a G-code model that adds all extruder material as if it shared one material price/density. The browser UI and quote layout are thoughtfully structured but were not visually exercised in a browser during this review.

## 2. What PrintMetric Actually Does

**VERIFIED:** The user enters or imports the one-print filament weight and print duration, selects a printer estimate and material density, enters cost assumptions and quantity, and receives an internal order breakdown and customer quote. The interface is a single page, with no routing, account, server API, bundler, framework, or third-party runtime library. See `index.html`, `app.js`, `pricing.js`, `gcode.js`, and `quote.js`.

**DOCUMENTED:** It is intended for hobbyists, independent sellers, and small print shops; GitHub Pages hosts the public static app. Its local-first and no-tracking claims align with source inspection: no `fetch`, analytics integration, or backend code was found in app sources. Third-party links exist for GitHub and donation providers, opened only on user action.

## 3. Application Architecture

- `index.html`: semantic page, labeled controls, quote form, output breakdown, hidden print sheet, and ordered script loading (`gcode.js`, `pricing.js`, `quote.js`, `app.js`).
- `style.css`: custom properties, grid/cards, focus states, responsive breakpoints at 840px and 520px, dark-color preference, and A4 print rules.
- `app.js`: static printer/material data, DOM wiring, localStorage, profile CRUD, validation UI, G-code upload state, display formatting, live calculation, clipboard summary, and `window.print()` workflow.
- `pricing.js`: pure validation, pricing, and EUR→USD conversion. UMD-style export supports browser global and Node tests.
- `gcode.js`: pure metadata parser, physical length-to-weight conversion, file-slice scanning policy, and parser errors.
- `quote.js`: ISO date validation for the quote-date range.
- `test/`: Node built-in tests and sample metadata fixtures. `package.json` defines only `node --test`; no application dependencies.
- `docs/printmetric-screenshot.png`, `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `LICENSE`: product/support material.

**Execution flow:** `DOMContentLoaded` → `boot()` builds printer/material dropdowns and binds listeners → storage restore applies persisted values → initial `onCalculate()`. User number-input events validate and debounce recalculation by 200 ms. G-code selection calls async `GCODE.parseFile()`, updates only fields that are blank or previously G-code-owned, then recalculates. `PRICING.calculatePricing()` is the calculation authority. Quote export copies current results into the hidden print sheet and invokes browser print UI; the browser's “Save as PDF” is the PDF mechanism.

## 4. Complete Feature Breakdown

| Feature | Source / behavior | Assessment |
|---|---|---|
| Cost calculation | `pricing.js: validatePricingInput`, `calculatePricing` | **VERIFIED:** Exact unrounded numeric flow; final displays use two decimals. See audit below. |
| Filament and density | `gcode.js: filamentLengthToWeight`; material presets in `app.js` | **VERIFIED:** Uses cylinder volume, mm³→cm³, times g/cm³. Presets are editable; material price remains manual. Density approximation and spool price are user assumptions. |
| Electricity | `pricing.js: calculatePricing` | **VERIFIED:** W/1000 × hours × EUR/kWh per unit, multiplied by quantity. Preset watts are estimates; no standby/preheat/other equipment model. |
| Machine wear | `pricing.js: calculatePricing` | **VERIFIED:** Flat €/unit × quantity, not hourly depreciation. Useful simple proxy; no maintenance, replacement, utilization or capital model. |
| Labor | `setupLaborMins`, `handsOnLaborMins` form inputs | **VERIFIED:** One setup charge/order plus per-unit minutes × quantity at a shared hourly rate. Legacy hands-on key retains per-unit meaning. |
| Waste and markup | `pricing.js: calculatePricing` | **VERIFIED:** Waste is applied to whole production subtotal including labor and machine/electricity; markup is then added to adjusted cost. Markup is not margin-on-sale. |
| Minimum price | `pricing.js: calculatePricing` | **VERIFIED:** Floor applies to full order after waste and markup. Effective unit value is floor/order quantity. |
| Printer presets | `app.js: PRINTERS`, `populatePrinters`, `setupPrinterChange` | **VERIFIED:** 26 named estimates plus editable “Other”; selecting named printer resets power to preset. Values are explicitly estimates, not model-specific measured profiles. |
| Material presets | `app.js: MATERIAL_PRESETS`, `setupMaterialChange` | **VERIFIED:** PLA/PETG/ABS/ASA/TPU/nylon/PC/custom; preset selection overwrites density. Custom preserves entered density. |
| G-code import | `gcode.js: parseSlicerMetadata`, `parseFile`; `app.js: validateAndParseGcode` | **VERIFIED:** See dedicated parser audit. Existing manual values are retained, but status reports imported metadata/estimates. |
| Multi-extruder | `gcode.js: parseSlicerMetadata` | **VERIFIED:** Lists are summed, with total fields preferred over per-extruder values. Current cost engine takes one aggregate gram value and one filament price. |
| Profiles | `app.js: loadProfiles`, `saveProfiles`, `captureCurrentProfile`, `applyProfile`, `setupProfiles` | **VERIFIED:** Named JSON profiles; array migration; overwrite/delete confirmations; selection applies settings. No import/export, schema version, or comprehensive profile validation. |
| Customer/job data | `app.js: PERSISTED_FIELD_IDS`, `syncPrintQuoteDetails` | **VERIFIED:** Seller/business/contact, quote number/date/expiry, customer, job and terms persist locally. Clear button removes only customer, job and notes (seller/quote data remains). |
| Customer PDF | `app.js: onExportPdf`; print sheet in `index.html`; print CSS in `style.css` | **VERIFIED:** Browser print dialog produces PDF; quote excludes internal cost breakdown/markup. Optional customer fields. User must initiate print and choose PDF. |
| EUR/USD | `pricing.js: convertEurToUsd`; `app.js: onCalculate` | **VERIFIED:** EUR-only cost engine; manual persisted USD per EUR; output-only conversion. No exchange-rate network call. |
| Local storage/reset | `app.js: setupPersistence`, `restorePersistedFields`, `resetAllLocalData` | **VERIFIED:** Input/change handlers save individual values; reset removes only `printmetric_` keys after confirm. Storage write exceptions warn; restore exceptions are silent. Browser clearing/private mode/device changes can lose data. |
| Offline | Static assets and local JS | **VERIFIED with qualification:** Once page assets are available, calculations and manual FX work without service calls. No service worker/offline cache; a first visit or cleared cache needs network to load GitHub Pages. |
| Validation/errors | `pricing.js: validatePricingInput`; `app.js: validateForm` | **VERIFIED:** Inline field errors, ARIA invalid/describedby state, negative and malformed input rejected; optional empty numbers are zero. G-code and storage errors have status/warnings. |

## 5. Calculation Engine Audit

### Formula verification

In `pricing.js: calculatePricing`:

- Filament €/unit = grams ÷ 1000 × €/kg.
- Electricity €/unit = watts ÷ 1000 × hours × €/kWh; energy kWh is separately reported.
- Wear €/unit = input amount.
- Setup labor = €/hour × setup minutes ÷ 60.
- Per-unit labor = €/hour × per-unit minutes ÷ 60.
- Order subtotal = (filament + electricity + wear + per-unit labor) × quantity + setup labor.
- Waste = subtotal × waste%; adjusted cost = subtotal + waste.
- Markup = adjusted cost × markup%; total = adjusted cost + markup.
- Minimum is `max(calculated order total, minimum order amount)` when minimum > 0.
- Unit quote = displayed total ÷ quantity; USD = EUR × manually supplied USD/EUR.

The implementation carries IEEE-754 floating-point values without intermediate rounding and `app.js: fmtMoney` renders two decimals. This is appropriate for a display estimate, but accumulated displayed breakdown rows may differ by cents from a separately rounded grand total in edge cases. There is no integer-cent settlement layer; quote uses rounded display values. No calculation defect was reproduced in executed tests.

### Independent example

For one 100 g unit at €20/kg, 2 h at 100 W and €0.30/kWh, €1 wear, setup 30 min, per-unit labor 10 min at €20/hour, quantity 3, waste 5%, markup 20%, minimum €50, and FX 1.10:

- Filament €2.00/unit; energy 0.2 kWh/unit and €0.06/unit; wear €1/unit.
- Setup labor €10/order; per-unit labor €3.333…; subtotal = `(2 + .06 + 1 + 3.333…) × 3 + 10` = €29.18.
- Waste €1.459; adjusted €30.639; markup €6.1278; computed total €36.7668.
- €50 minimum wins; quote unit equivalent €16.67; converted order total €55.00.

This is consistent with source formula and intended order-level floor.

### Validation and edge cases

**VERIFIED:** Filament grams must be >0; filament €/kg can be zero; optional costs/times/power/markup/waste/minimum may be zero but not negative; quantity is required in the UI and must be positive integer; physical diameter/density and FX rate must be >0 in UI. The core module itself defaults missing quantity to 1 for backward compatibility; UI prevents that omission. Blank optional values become zero. Markup may exceed 100% by design.

**POTENTIAL ISSUE:** `Number()` accepts scientific notation and extremely large finite values without caps. Multiplication can overflow to Infinity after validation (each input is finite); `fmtMoney` then renders `—`, while some result fields may still be misleading. This is an extreme-value robustness issue, not typical operation.

**POTENTIAL ISSUE:** Electricity model multiplies print-time/power per unit by quantity, so identical batch prints assume the same per-part print duration and machine load. It does not model batch nesting, shared bed warmup, parallel printers, or actual combined print duration; labels should keep the per-unit assumption explicit.

## 6. G-code Parser Audit

**VERIFIED patterns in `gcode.js: parseSlicerMetadata`:** time/time_elapsed numeric seconds; estimated printing time textual d/h/m/s; Cura `Filament used: 1.2m` and gram-like `Filament used: 12.5g`; `Filament weight`; bracketed `filament|total filament used/length/weight [mm|m|g]`; generic material/filament length with explicit units. Lists are parsed and summed. Slicer gram metadata wins for costing while length is kept. First matching values generally win within each per-extruder or total category. Explicit total fields replace per-extruder aggregates.

Length to mass uses π × (diameter/2)² × length × density with unit conversions. UI recalculates only length-derived grams when diameter or density changes; slicer weight remains fixed. Async import sequence prevents an older read from replacing a newer selection.

File scanning reads beginning/tail with `Blob.slice`; full scans only up to 16 MiB when metadata is incomplete; larger files get expanded edge sampling; files above 2 GiB are rejected. `bytesRead` includes repeated edge bytes when a fallback is used, so it is an I/O-work count, not unique coverage.

Limitations/risks:

- **VERIFIED:** It is metadata-comment parsing, not G-code motion analysis; generic files with no supported comments need manual entry.
- **VERIFIED:** Multi-tool values are summed to one mass and priced using one material price/density. Mixed-material prints, soluble support, purge/tower waste and tool-specific spool prices can be inaccurate.
- **POTENTIAL ISSUE:** There is no slicer/version identity detection or confidence indicator. Numeric parsing salvages valid tokens from malformed lists; duplicate/contradictory metadata follows first-match/total-precedence rules, not conflict reporting.
- **POTENTIAL ISSUE:** Some slicers encode duration variants or metadata names not covered by the current regex. Fixtures cover named representative patterns, not a broad corpus across slicer versions.
- **VERIFIED:** Bounded sampling may miss metadata located in the middle of a large file; UI can report scan limitation and allow manual correction.
- **POTENTIAL ISSUE:** Parser scans sampled text after splitting into lines and allocates those strings; file bytes are bounded, but not a streaming line parser. This remains modest (few MiB maximum in sampled branches).

## 7. User Experience Review

**VERIFIED from markup/CSS:** Inputs are grouped by printer/G-code, quote details, profiles, filament/print time, electricity/wear, labor, pricing, and results. Labels exist for controls; visible keyboard focus, polite status regions, reduced-motion handling for animated totals, responsive single-column layout at tablet widths and print-specific layout are implemented. Quote fields collapse to one column at <=840px; totals likewise.

**Assessment:** The workflow is capable but long and asks a first-time user to understand many concepts (watts, density, wear, waste, markup, exchange rate). Defaults provide markup/waste and printer/material presets, but there is no guided “quick estimate” mode or explanation of which inputs are essential vs optional. Printer wattage uncertainty is acknowledged. The advanced physical filament fields are appropriately collapsed.

**POTENTIAL ISSUE:** Results are live-updated, making the Calculate button partly redundant; user feedback relies heavily on status regions, including a visually hidden calculation status. Browser visual QA and assistive technology checks were not performed. No automated contrast or mobile interaction test exists. `aria-hidden="true"` is set on the print sheet even though it becomes visible in print; this deserves accessibility review in PDF/browser contexts.

The quote workflow is stronger than a basic calculator: seller, contact, quote number, dates, customer, job and notes; customer output suppresses internal costs. It does not include tax/VAT, shipping, discounts, payment terms/acceptance, or a direct download library; current system-print flow is intentionally low dependency.

## 8. Reliability and Security Review

**VERIFIED:** No backend, analytics, remote script dependency, dynamic HTML insertion of user fields, or automatic FX/network request was found. User text is assigned via `textContent`; profile names go into option `textContent`. External links use `rel="noopener"`. G-code file content is treated as text metadata; filenames are extension checked and file size bounded. Local data is isolated by `printmetric_` prefix during reset.

**POTENTIAL ISSUE:** localStorage is best-effort browser storage: quotas, browser/site data clearing, private mode, browser/device changes, or storage-disabled contexts can lose data. Per-field saves warn in developer console but do not clearly alert users; restore errors silently fall back. There is no backup, JSON export/import, or profile integrity/schema versioning. A malformed profile document is ignored wholesale, potentially losing access to otherwise valid entries.

**DOCUMENTED:** The app claims stored data stays local; source supports that claim for this implementation. The hosting provider necessarily serves static assets when online; this is distinct from application telemetry or user-input uploads.

**VERIFIED limitation:** There is no service worker, so “offline operation” means no runtime service needed after the application files are already loaded/cached by the browser, not reliable offline-first installation.

## 9. Testing and Verification Results

**Executed:** `node --test` (Node available; `npm` command unavailable in this environment). Result: 81 tests, 80 passed, 1 failed. All pricing, G-code, storage, accessibility-markup, quote-output, currency, and repository-documentation checks passed except the specific repository-quality assertion below.

**Failure:** `test/repository-quality.test.js` expects `.github/workflows/test.yml`; file is absent from the supplied checkout and test fails with ENOENT. The changelog says a GitHub Actions workflow was added, so local artifact and documentation are inconsistent. No files were modified.

Coverage is strongest for pure formula behavior, G-code fixtures/sampling, local-storage code patterns, and static markup. It is not a browser integration suite: no end-to-end interaction, actual localStorage quota behavior, cross-browser behavior, rendered PDF comparison, keyboard screen-reader run, or real slicer-generated corpus run. Profile save/apply/delete behavior is lightly/static tested rather than fully simulated. There are no explicit tests for extreme numeric overflow, mixed-material extruders, duplicate conflicting metadata, or precision/display reconciliation.

## 10. Problems and Limitations

1. **VERIFIED:** Repository-quality test references missing CI workflow; source checkout has no `.git` directory, so no local commit/dirty-state or precise remote commit comparison can be made.
2. **VERIFIED:** Multi-extruder costs are collapsed to one material basis.
3. **VERIFIED:** Browser print is the PDF implementation and can vary by browser/printer settings; not visually verified here.
4. **VERIFIED:** No portable backup/export exists for user data or named profiles.
5. **VERIFIED:** No actual print measurement, business overhead allocation, depreciation model, order history, inventory, tax/shipping, or customer management.
6. **POTENTIAL ISSUE:** Storage failure has weak user-visible recovery; exact browser persistence is environment-dependent.
7. **POTENTIAL ISSUE:** Very large accepted numeric values can overflow downstream arithmetic.
8. **POTENTIAL ISSUE:** Public repo/live application could differ from supplied checkout; exact comparison could not be completed because local Git metadata is absent and GitHub source endpoints did not expose individual files through the available fetch path. The accessible repo page reflects the same project/docs themes, but that does not prove byte-for-byte code parity or which revision is newest.

## 11. Recommended Improvements

### A. Critical

- **RECOMMENDATION:** Restore/commit the missing CI workflow or revise the quality test to match the intended repository; otherwise the documented test command fails.
- **RECOMMENDATION:** Add an explicit user-facing backup/export and validated restore path for settings/profiles. This reduces the most consequential local-first data-loss risk without requiring an account.
- **RECOMMENDATION:** Detect and communicate invalid/overflowed computed totals; guard calculations against non-finite intermediates and offer reasonable configurable input bounds.

### B. High priority

- **RECOMMENDATION:** Treat G-code multi-tool/multi-material data explicitly: retain per-tool gram/length values and permit material price/density per tool, or clearly label aggregate output as an estimate when materials differ.
- **RECOMMENDATION:** Add an onboarding path with a minimal estimate mode and short explanations for watts, wear, markup vs margin, waste, and per-unit assumptions.
- **RECOMMENDATION:** Make data persistence status visible and provide recoverable profile parse/version migration messages.
- **RECOMMENDATION:** Test and document actual browser print-to-PDF output (Chrome/Edge/Firefox) with user-entered long names/notes and page clipping checks.

### C. Medium priority

- **RECOMMENDATION:** Broaden parser fixtures from real, anonymized files and report duplicate/conflicting metadata rather than silently choosing a field.
- **RECOMMENDATION:** Clarify per-unit print-time/energy assumptions for quantity; consider a batch mode for shared setup/bed warm-up or multiple printers.
- **RECOMMENDATION:** Add deterministic decimal/currency rounding policy (e.g. cents at quote boundary) and make displayed row totals reconcile transparently.
- **RECOMMENDATION:** Add browser-level tests for profile lifecycle, validation, storage failure, keyboard flow, and PDF print-sheet output.
- **RECOMMENDATION:** Improve printer preset provenance/date and user-defined printer presets so estimates can be calibrated and retained without overloading one “Other” profile.

### D. Future possibilities

- **RECOMMENDATION:** Print-job history with saved assumptions and quote snapshots, locally exportable; value: repeat pricing and audit trail. Complexity: medium, with privacy/storage controls.
- **RECOMMENDATION:** Filament spool/inventory tracking with remaining grams and per-spool purchase cost; value: real material cost and depletion visibility. Complexity: medium/high due to multi-spool/tool support.
- **RECOMMENDATION:** Cost comparison by printer using same job and measured watt/depreciation assumptions; value: actionable equipment decisions. Complexity: medium.
- **RECOMMENDATION:** Quote template options and optional tax/shipping/payment terms; value for sellers. Complexity: low/medium, but regional tax behavior needs deliberate scope.
- **RECOMMENDATION:** Optional installable offline app (service worker/PWA) only if offline usage is a demonstrated need; complexity medium and cache-update lifecycle matters.

## 12. Prioritized Development Roadmap

1. Reconcile CI artifact and make clean checkout `node --test` pass.
2. Add local backup/export and validated restore, with a versioned profile/data schema.
3. Guard non-finite calculations and define quote rounding behavior.
4. Improve mixed-material/multi-extruder costing or communicate aggregate limitations directly in the UI.
5. Add guided first-run estimate workflow and clarify inputs/assumptions.
6. Validate print-to-PDF layout in major browsers using realistic long content.
7. Expand parser fixture corpus and conflict/unsupported-format reporting.
8. Add browser integration tests and storage failure coverage.
9. Add reusable measured printer/material profiles with provenance.
10. Consider local job history/inventory only after backup and data lifecycle are robust.

## 13. Overall Technical Assessment

**VERIFIED assessment:** For a small static app, architecture is appropriately simple, modular at the important boundaries, dependency-free, and testable. The pure pricing module and parser have useful functional coverage. Input validation, local-only data handling, semantic labels, responsive styling, and explicit formulas are strengths. Maintainability is reasonable, though `app.js` owns many unrelated UI/data workflows and global arrays/state; growth should be kept modular.

The code is suitable as a transparent personal/small-maker estimator, but is not yet a robust business system. Data portability, CI/repository consistency, browser-level verification, mixed-material costing, and real-world cost modeling are the gaps to close first.

## 14. Overall Product Assessment

**Hobbyists:** Good for understanding the difference between filament-only and fuller costs; requires realistic inputs to be useful.

**Independent makers:** Useful for quoting simple repeatable work and generating a clean customer-facing quote. Lack of backup/history, tax/shipping, and order tracking limits day-to-day business use.

**Small businesses:** Helpful as a lightweight estimator, not a substitute for production planning/accounting; lacks batch scheduling, machine utilization, inventory, multi-printer/material costing, and auditable records.

**What is already good:** transparent formula, sensible cost categories, separate setup/per-unit labor, quantity-aware minimum, manual currency conversion, no dependency/backend, useful local profiles, slicer metadata import, customer-only quote output.

**What is technically weak or missing:** CI checkout mismatch, Git provenance, recoverable storage, realistic mixed-material costing, browser-rendered verification, job history and data exports.

**What I would improve first:** fix the failing clean-checkout/CI state, implement portable data backup, then add clear mixed-material and calculation-boundary behavior. Those address reliability and correctness before adding breadth.

**What could distinguish PrintMetric:** a privacy-first, transparent estimator that shows assumptions and uncertainty, learns from measured power/material usage, and turns a quote into a recoverable job record. Trustworthy calibration and portable records would be more defensible than a longer preset list.

### Top 10 improvements ranked by impact and effort

| Rank | Improvement | Impact | Effort |
|---:|---|---|---|
| 1 | Fix missing CI workflow/test mismatch | High | Low |
| 2 | Settings/profile export and validated restore | High | Medium |
| 3 | Guard overflow/non-finite calculations and define rounding | High | Low–medium |
| 4 | Multi-material/multi-tool costing or unmistakable estimate warning | High | Medium–high |
| 5 | Browser PDF and mobile/keyboard integration verification | High | Medium |
| 6 | Guided first-time/quick-estimate flow | High | Medium |
| 7 | Visible persistence failure and profile migration recovery | Medium–high | Medium |
| 8 | Broader real-world parser fixtures and conflict detection | Medium–high | Medium |
| 9 | Saved job/quote history backed by local export | Medium | Medium–high |
| 10 | Measured custom printer/material presets with provenance | Medium | Medium |

## Source map

- Pricing/formulas/validation: `pricing.js` (`validatePricingInput`, `calculatePricing`, `convertEurToUsd`).
- UI, persistence, presets, profiles, validation, import state, quote: `app.js` (`boot`, `restorePersistedFields`, `setupProfiles`, `validateAndParseGcode`, `validateForm`, `onCalculate`, `onExportPdf`).
- Metadata parsing/file safety/conversion: `gcode.js` (`parseSlicerMetadata`, `parseFile`, `filamentLengthToWeight`).
- Quote dates: `quote.js` (`isIsoDate`, `validateDateRange`).
- Structure and fields: `index.html`; responsive/print: `style.css`.
- Automated coverage: `test/pricing.test.js`, `test/gcode.test.js`, `test/local-storage.test.js`, `test/accessibility.test.js`, `test/quote-output.test.js`, `test/repository-quality.test.js`.

