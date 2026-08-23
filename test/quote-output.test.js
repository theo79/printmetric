const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "style.css"), "utf8");
const printSheet = html.slice(html.indexOf('<section id="printSheet"'), html.indexOf("<!-- Scripts -->"));

test("customer quote supports optional professional quote fields", () => {
  for (const id of [
    "sellerBusinessName",
    "sellerContactDetails",
    "quoteNumber",
    "quoteDate",
    "quoteValidUntil",
    "customerName",
    "jobName",
    "quoteNotes"
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /id="quoteDate"[^>]*type="date"/);
  assert.match(html, /id="quoteValidUntil"[^>]*type="date"/);
});

test("seller and quote defaults use the existing local persistence system", () => {
  for (const id of [
    "sellerBusinessName",
    "sellerContactDetails",
    "quoteNumber",
    "quoteDate",
    "quoteValidUntil"
  ]) {
    assert.match(app, new RegExp(`PERSISTED_FIELD_IDS[\\s\\S]*?"${id}"`));
  }
});

test("customer print sheet excludes internal costing and unsupported charges", () => {
  assert.doesNotMatch(printSheet, /waste|failure allowance|machine wear|labor cost|markup|profit/i);
  assert.doesNotMatch(printSheet, /VAT|tax|shipping|discount/i);
  assert.match(printSheet, /Quote number/);
  assert.match(printSheet, /Valid until/);
  assert.match(printSheet, /Notes \/ terms/);
});

test("print layout explicitly targets clean A4 output", () => {
  assert.match(css, /@page\s*\{[\s\S]*?size:\s*A4 portrait/);
  assert.match(css, /break-inside:\s*avoid/);
});
