const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("FX conversion has no automatic network implementation", () => {
  assert.doesNotMatch(app, /\bfetch\s*\(/);
  assert.doesNotMatch(app, /Frankfurter|exchangerate\.host|ER-API|open\.er-api/i);
});

test("manual exchange rate remains locally persisted", () => {
  assert.match(app, /PERSISTED_FIELD_IDS[\s\S]*?"usdPerEur"/);
  assert.match(app, /PRICING\.convertEurToUsd\(displayedTotalEUR, fxRate\)/);
});

test("UI explicitly describes manual non-automatic conversion", () => {
  assert.match(html, /USD per EUR \(manual rate\)/);
  assert.match(html, /not updated automatically/i);
  assert.match(html, /not fetched or updated automatically/i);
  assert.doesNotMatch(html, /Conversion provided by public APIs/i);
});
