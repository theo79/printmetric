const test = require("node:test");
const assert = require("node:assert/strict");

const { isIsoDate, validateDateRange } = require("../quote.js");

test("accepts optional and chronological quote dates", () => {
  assert.equal(validateDateRange("", "").valid, true);
  assert.equal(validateDateRange("2026-08-23", "").valid, true);
  assert.equal(validateDateRange("2026-08-23", "2026-08-23").valid, true);
  assert.equal(validateDateRange("2026-08-23", "2026-09-22").valid, true);
});

test("rejects an expiry before the quote date", () => {
  const result = validateDateRange("2026-08-23", "2026-08-22");
  assert.equal(result.valid, false);
  assert.match(result.message, /cannot be earlier/i);
});

test("rejects malformed or impossible dates", () => {
  assert.equal(isIsoDate("2026-02-29"), false);
  assert.equal(isIsoDate("not-a-date"), false);
  assert.equal(validateDateRange("2026-02-29", "2026-03-01").valid, false);
});
