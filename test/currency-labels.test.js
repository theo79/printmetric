const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

test("all monetary inputs are explicitly labelled in EUR", () => {
  assert.match(html, /for="filamentCostPerKg">Filament Price \(€\/kg\)<\/label>/);
  assert.match(html, /for="electricityCost">Electricity Price \(€\/kWh\)<\/label>/);
  assert.match(html, /for="machineWearCost">Machine Wear per Unit \(€\)<\/label>/);
  assert.match(html, /for="laborCostPerHour">Labor Rate \(€\/hour\)<\/label>/);
  assert.match(html, /for="minimumPrice">Minimum Order Price \(€\)<\/label>/);
  assert.doesNotMatch(html, /\[€\s*\/\s*\$\]/);
});

test("results and customer quote distinguish base EUR from converted USD", () => {
  assert.match(html, /Base currency — EUR \(€\)/);
  assert.match(html, /Converted — USD \(\$\)/);
  assert.match(html, /Unit Price \(EUR\)/);
  assert.match(html, /Total Price \(EUR\)/);
  assert.match(app, /Converted USD: \$/);
  assert.match(app, /Manual conversion rate: 1 EUR/);
});

test("legacy storage-compatible monetary field ids remain unchanged", () => {
  for (const id of [
    "filamentCostPerKg",
    "electricityCost",
    "machineWearCost",
    "laborCostPerHour",
    "minimumPrice",
    "usdPerEur"
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
    assert.match(app, new RegExp(`"${id}"`));
  }
});
