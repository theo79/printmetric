# Changelog

All notable changes to PrintMetric will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project intends to use semantic versioning when releases are tagged.

## [Unreleased]

### Added

* Pure, tested pricing calculations with setup labor and per-unit labor.
* Material-density and filament-diameter-aware length-to-weight conversion.
* Multi-extruder G-code metadata parsing for Cura, PrusaSlicer, SuperSlicer, OrcaSlicer, and Bambu Studio patterns.
* Memory-bounded G-code file scanning using beginning/end `Blob.slice()` reads.
* Inline numeric validation and accessibility improvements.
* Local seller and quote metadata plus professional A4 customer quotes.
* Local-data privacy controls and documented storage behavior.
* Automated Node test suite and GitHub Actions workflow.

### Changed

* Renamed user-facing profit margin terminology to markup while preserving the calculation.
* Clarified waste/failure allowance and minimum order price semantics.
* Made EUR the explicit base currency and retained manual-only USD conversion.
* Separated internal costing information from customer-facing quote output.

### Removed

* Unused public exchange-rate provider implementations.
* GitHub Pages-incompatible `/mnt/data/logo.png` fallbacks.

