const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

test("page includes useful description and Open Graph metadata", () => {
  const html = read("index.html");
  assert.match(html, /<meta name="description" content="[^"]+"/);
  for (const property of ["og:title", "og:description", "og:type", "og:url", "og:image", "og:image:alt"]) {
    assert.match(html, new RegExp(`<meta property="${property}" content="[^"]+"`));
  }
});

test("GitHub Pages markup has no workspace-only logo fallback", () => {
  assert.doesNotMatch(read("index.html"), /\/mnt\/data\/logo\.png/);
});

test("README documents formulas, compatibility and the application screenshot", () => {
  const readme = read("README.md");
  for (const term of [
    "filament cost per unit",
    "electricity cost per unit",
    "machine wear per unit",
    "setup labor cost",
    "labor cost per unit",
    "waste allowance",
    "markup amount",
    "minimum order price",
    "effective unit price",
    "converted USD total"
  ]) {
    assert.match(readme, new RegExp(term, "i"));
  }
  assert.match(readme, /Supported G-code and slicers/);
  assert.match(readme, /docs\/printmetric-screenshot\.png/);
  assert.equal(fs.existsSync(path.join(root, "docs", "printmetric-screenshot.png")), true);
});

test("repository includes contribution, changelog and CI files", () => {
  assert.equal(fs.existsSync(path.join(root, "CONTRIBUTING.md")), true);
  assert.equal(fs.existsSync(path.join(root, "CHANGELOG.md")), true);
  const workflow = read(path.join(".github", "workflows", "test.yml"));
  assert.match(workflow, /push:/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /npm test/);
});

test("confirmed dead skipZeroWarning path stays removed", () => {
  assert.doesNotMatch(read("app.js"), /skipZeroWarning/);
});
