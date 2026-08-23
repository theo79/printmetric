const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const readme = fs.readFileSync(path.join(__dirname, "..", "README.md"), "utf8");

function functionSource(name, nextName) {
  return app.slice(app.indexOf(`function ${name}`), app.indexOf(`function ${nextName}`));
}

test("customer and job fields are explicitly grouped as local data", () => {
  assert.match(app, /CUSTOMER_JOB_FIELD_IDS\s*=\s*\["customerName", "jobName", "quoteNotes"\]/);
  assert.match(app, /PERSISTED_FIELD_IDS\s*=\s*\[\s*\.\.\.CUSTOMER_JOB_FIELD_IDS/);
});

test("narrow clear action removes only customer and job keys", () => {
  const clearFunction = functionSource("clearCustomerJobData", "resetAllLocalData");
  assert.match(clearFunction, /CUSTOMER_JOB_FIELD_IDS\.forEach/);
  assert.match(clearFunction, /localStorage\.removeItem\(storageKey\(id\)\)/);
  assert.doesNotMatch(clearFunction, /PROFILES_STORAGE_KEY|localStorage\.clear|STORAGE_KEY_PREFIX/);
  assert.match(html, />Clear customer\/job data<\/button>/);
});

test("full reset is confirmed and removes only PrintMetric-owned keys", () => {
  const resetFunction = functionSource("resetAllLocalData", "setupLocalDataControls");
  assert.match(resetFunction, /confirm\(/);
  assert.match(resetFunction, /key\.startsWith\(STORAGE_KEY_PREFIX\)/);
  assert.doesNotMatch(resetFunction, /localStorage\.clear\(/);
  assert.match(html, />Reset all local data<\/button>/);
});

test("privacy documentation lists stored data and local-only behavior", () => {
  for (const key of [
    "printmetric_customerName",
    "printmetric_jobName",
    "printmetric_quoteNotes",
    "printmetric_usdPerEur",
    "printmetric_profiles"
  ]) {
    assert.match(readme, new RegExp(key));
  }
  assert.match(readme, /not sent to a PrintMetric server/i);
  assert.match(readme, /no backend, analytics, or tracking/i);
});
