const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("every form control has an associated visible label", () => {
  const controlIds = [...html.matchAll(/<(?:input|select|textarea)\b[^>]*\bid="([^"]+)"[^>]*>/g)]
    .map((match) => match[1]);

  for (const id of controlIds) {
    assert.match(html, new RegExp(`<label\\b[^>]*\\bfor="${id}"[^>]*>`), `${id} needs an associated label`);
  }
});

test("buttons expose visible accessible names", () => {
  const buttons = [...html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)];
  assert.ok(buttons.length > 0);
  for (const [, contents] of buttons) {
    assert.ok(contents.replace(/<[^>]+>/g, "").trim(), "button needs visible text");
  }
});

test("page has a main heading and polite status regions", () => {
  assert.match(html, /<h1\b[^>]*>[^<]+<\/h1>/);
  assert.match(html, /id="gcodeStatus"[^>]*role="status"/);
  assert.match(html, /id="calculationStatus"[^>]*role="status"/);
});
