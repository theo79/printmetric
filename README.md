# PrintMetric

### Know your real print cost.

PrintMetric is a lightweight, browser-based tool for calculating the real cost of a 3D print.

It helps makers, hobbyists, and small print shops move beyond simple filament-cost estimates by including the other costs that are easy to overlook.

**No login. No subscription. No tracking. Just transparent 3D printing cost calculation.**


## Try PrintMetric Online

**https://theo79.github.io/printmetric/**

No installation required — it runs directly in your browser.


## What PrintMetric Calculates

PrintMetric can calculate your print cost using:

* Filament usage
* Filament price per kg
* Print time
* Electricity cost
* Printer power consumption
* Machine wear
* Hands-on labor
* Profit margin
* Failure / waste allowance
* Quantity
* Minimum selling price

The internal cost breakdown makes it easy to see where your money is actually going before deciding what to charge.


## Printer Presets

Select your printer and PrintMetric automatically fills an estimated average power consumption.

The printer database includes popular models from manufacturers such as:

* Bambu Lab
* Prusa
* Creality
* Elegoo
* Anycubic
* Artillery

The estimated wattage is always editable.

If you have measured the real average consumption of your printer, simply replace the preset value for more accurate calculations.

You can also select **Other** and enter the power consumption manually.


## Material Presets

PrintMetric includes density presets for common 3D printing materials:

* PLA
* PETG
* ABS
* ASA
* TPU
* Nylon (PA)
* PC
* Custom materials

Selecting a material automatically fills its approximate density.

The density remains editable, so you can use the exact value provided by your filament manufacturer when available.

Your actual filament price per kg is always entered manually — because real spool prices vary.


## G-code Support

Upload a G-code file and PrintMetric can automatically detect:

* Print time
* Filament usage
* Filament weight when available

When the G-code provides filament length instead of weight, PrintMetric can calculate the approximate weight using filament diameter and material density.

Compatible with metadata produced by common slicers.

Manual inputs remain available when metadata is missing or when you want to override an estimate.


##  Failure / Waste Allowance

Failed prints cost more than just filament.

PrintMetric includes an optional **Failure / Waste Allowance (%)** to account for expected losses from:

* Wasted material
* Electricity
* Machine use
* Labor

The allowance is treated as part of the real production cost before the profit margin is calculated.

Set it to **0%** if you don't want to include a failure allowance.


## Cost & Pricing Breakdown

PrintMetric provides an internal breakdown including:

* Filament cost
* Energy used
* Electricity cost
* Labor cost
* Machine wear
* Production subtotal
* Failure / waste allowance
* Adjusted production cost
* Profit
* Final price per print
* Quantity
* Grand total

This breakdown is intended for **you**, not your customer.


## Customer Quote PDF

PrintMetric can generate a clean, customer-facing quote directly from the browser.

The customer quote can include:

* Customer name
* Job / part name
* Material
* Printer
* Quantity
* Estimated print time
* Unit price
* Total price
* EUR and indicative USD pricing
* Notes

Your internal business information stays private.

The customer PDF does **not** expose:

* Filament cost
* Electricity cost
* Labor cost
* Machine wear
* Failure / waste allowance
* Production subtotal
* Profit margin
* Profit amount

Your customer sees the quote — not how you calculated your margin.


## Profiles & Local Storage

Save pricing profiles for different printers, materials, or working setups.

Profiles can store settings such as:

* Filament pricing
* Material
* Electricity rate
* Labor rate
* Profit margin
* Failure / waste allowance
* Printer and power settings
* Minimum price
* Quantity

PrintMetric also remembers relevant settings locally in your browser.

No account or cloud storage is required.


## 💱 EUR / USD

PrintMetric uses EUR as the primary calculation currency and can display an indicative USD equivalent.

The EUR → USD rate can be entered manually, keeping the calculator independent from external exchange-rate services.


## Why PrintMetric Exists

A 3D print doesn't cost only the price of the filament.

Real printing costs can also include electricity, printer wear, hands-on work, failed prints, wasted material, and the time your machine is occupied.

Ignoring those costs can easily lead to underpricing.

**PrintMetric makes those costs visible.**

Know the cost. Set your margin. Price your work properly.


## Privacy

PrintMetric is designed to stay simple.

* No account
* No login
* No subscription
* No tracking
* No backend required

Calculations and saved settings stay in your browser.

## Tech Stack

* Vanilla HTML
* CSS
* JavaScript
* Browser Local Storage
* No framework
* No backend

PrintMetric is hosted using GitHub Pages.


##  Like PrintMetric?

If PrintMetric helped you price your prints more accurately, consider **starring the repository**.

A GitHub star helps other makers discover the project and supports its continued development.

**https://github.com/theo79/printmetric**

If PrintMetric saved you from underpricing a print, consider buying me a coffee ☕

---

## Feedback & Contributions

Suggestions, bug reports, printer data corrections, and improvement ideas are welcome.

If you find an issue, feel free to open an issue on GitHub.

---

## Author

Built by **Theocharis Anastopoulos**.

Engineer. Maker. Tool builder.

---

**PrintMetric — Know your real print cost.**
