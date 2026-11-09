<div align="center">

<img src="assets/logo-horizontal.png" alt="PrintMetric Banner" width="750" style="border-radius: 12px; margin-bottom: 1.25rem;" />

# PrintMetric 
**Know your real 3D print cost. Local-first, private, and zero dependencies.**

[![Deploy](https://github.com/theo79/printmetric/actions/workflows/pages/pages-build-deployment/badge.svg)](https://github.com/theo79/printmetric/actions)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-blue.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/theo79/printmetric.svg?style=social)](https://github.com/theo79/printmetric)

[Live Web App](https://theo79.github.io/printmetric/) · [Report Bug](https://github.com/theo79/printmetric/issues) · [Request Feature](https://github.com/theo79/printmetric/issues)

</div>

---

### Why PrintMetric?

Most 3D printing calculators only account for raw spool weight. **PrintMetric** captures the true operational economics of additive manufacturing:

* ⚡ **True Energy Consumption:** Computes electricity based on printer wattage and exact print duration.
* 📉 **Machine Depreciation:** Accounts for nozzle wear, bed degradation, and maintenance amortization.
* ⏱️ **Hands-on Labor:** Cleanly separates one-off prep/slicing setup from per-unit finishing and post-processing.
* 📦 **Slicer Metadata Dropzone:** Drag & drop `.gcode` or `.3mf` files (Bambu Studio, OrcaSlicer, PrusaSlicer, Cura) for automatic parameter extraction.
* 📊 **Two-Column Sticky Dashboard:** Live order total and detailed breakdowns remain permanently pinned as you scroll through inputs.
* 📄 **Client-Ready PDF Quotes:** Generate clean, branded quotation sheets with one click without exposing your internal margins.
* 🔒 **100% Private & Local-First:** Runs entirely in your browser using Vanilla JS. No tracking, no backend, no logins, and full offline capability.

---

## Try PrintMetric

### 1. Online (Instant Browser Access)
**[https://theo79.github.io/printmetric/](https://theo79.github.io/printmetric/)**  
Zero installation required. Works on any modern desktop, tablet, or mobile browser.

### 2. Standalone Single-File (Offline Version)
Download the standalone `PrintMetric-standalone.html` file from the [latest GitHub Release](https://github.com/theo79/printmetric/releases).  
Double-click to launch in any browser—no internet connection, web server, or Node runtime required.

---

## ⚙️ How It Works

### 1. Live Sticky Estimation
As you change printer models, filament prices, or job parameters, the sticky **Order Total** card updates in real time. It features:
* Real-time EUR calculation with converted USD equivalent (using your manual exchange rate).
* Calculated effective price per unit (`€ / unit`).
* An expandable **Cost Breakdown** tree detailing exact material, energy, labor, machine wear, and margin components.

### 2. Slicer Metadata Import (`.gcode` & `.3mf`)
Simply drag and drop your exported sliced file directly into the upload card:
* **Automatic extraction:** Instantly parses print time, filament length, and slicer-reported filament weight.
* **Smart density fallback:** If only filament length is embedded, PrintMetric derives the weight using your material density and diameter settings.
* **Safe memory inspection:** Large files are read via bounded chunks (`Blob.slice()`) without loading entire gigabyte files into RAM.
* **Multi-slicer support:** Compatible with metadata from Bambu Studio, OrcaSlicer, PrusaSlicer, SuperSlicer, and Cura.

### 3. Built-In Presets
* **Printer Presets:** Pre-configured average power draw (W) for popular printers (Bambu Lab, Prusa, Creality, Elegoo, Anycubic, Artillery, and Custom).
* **Material Density Presets:** Quick densities for PLA, PETG, ABS, ASA, TPU, Nylon (PA), PC, or custom spools.

---

## Pricing & Costing Engine

PrintMetric calculates all base figures in EUR using double-precision floating point:

$$\text{Filament Cost}_{\text{unit}} = \frac{\text{Grams}}{1000} \times \text{Price}_{\text{kg}}$$

$$\text{Electricity Cost}_{\text{unit}} = \frac{\text{Watts}}{1000} \times \text{Hours} \times \text{Rate}_{\text{kWh}}$$

$$\text{Labor}_{\text{total}} = \left(\text{Rate}_{\text{hr}} \times \frac{\text{Setup Mins}}{60}\right) + \left(\text{Rate}_{\text{hr}} \times \frac{\text{Unit Mins}}{60} \times \text{Quantity}\right)$$

$$\text{Production Subtotal} = \left(\text{Filament} + \text{Electricity} + \text{Wear} + \text{Unit Labor}\right) \times \text{Quantity} + \text{Setup Labor}$$

$$\text{Order Total} = \max\left(\text{Adjusted Cost} \times \left(1 + \frac{\text{Markup \%}}{100}\right), \text{Minimum Order Price}\right)$$

---

## Privacy-Preserving Customer Quote PDF

Clicking **Customer Quote PDF** generates an A4-ready, printable quote:

| Included on Customer Quote | Hidden (Private to You) |
| :--- | :--- |
| Seller business name & contact | Material cost per kg & usage breakdown |
| Quote number & issue/validity dates | Printer wattage & electricity rates |
| Customer name & job title | Internal machine wear allowances |
| Print duration, material & printer model | Hourly labor rate & internal prep times |
| Effective unit price & final order total | Markup percentage (%) & profit margins |
| Converted USD total (with rate note) | Waste / failure contingency percentages |

---

## Local Storage & Profiles

PrintMetric saves your workspace automatically to browser `localStorage`:
* **State Persistence:** Form values, seller headers, and exchange rates persist across reloads.
* **Named Profiles:** Save and restore distinct configurations for different machines or shop workflows.
* **Zero Tracking:** Data never touches an external server. You retain full control with dedicated **Clear customer/job data** and **Reset all local data** controls.

---

## Tech Stack & Development

* **Frontend:** Plain Semantic HTML5, Modern CSS Grid/Flexbox (with full Light/Dark mode support), and Vanilla JavaScript (ES6+).
* **Testing:** Automated tests run on Node.js native test runner (`node:test`, `node:assert/strict`).
* **Dependencies:** Exactly **0** runtime dependencies.

### Running Tests Locally
```bash
node --test
Generate the single-file offline bundle:

```bash
node scripts/bundle-single-file.js

Author
Built by Theocharis Anastopoulos
GitHub Profile