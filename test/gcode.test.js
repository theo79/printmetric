const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  filamentLengthToWeight,
  parseSlicerMetadata,
  parseFile
} = require("../gcode.js");

function fixture(name) {
  return fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8");
}

function closeTo(actual, expected, tolerance = 1e-12) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

test("converts 1m of 1.75mm PLA using its selected density", () => {
  closeTo(filamentLengthToWeight(1000, 1.75, 1.24), 2.9825495255018097);
});

test("converts 1m of 1.75mm PETG using its selected density", () => {
  closeTo(filamentLengthToWeight(1000, 1.75, 1.27), 3.05470798176395);
});

test("converts 1m of 1.75mm TPU using its selected density", () => {
  closeTo(filamentLengthToWeight(1000, 1.75, 1.21), 2.910391069239669);
});

test("supports 2.85mm filament", () => {
  closeTo(filamentLengthToWeight(1000, 2.85, 1.24), 7.91045176192276);
});

test("supports a custom material density", () => {
  closeTo(filamentLengthToWeight(750, 1.75, 1.5), 2.705942109830271);
});

test("rejects invalid physical inputs", () => {
  assert.equal(filamentLengthToWeight("invalid", 1.75, 1.24), null);
  assert.equal(filamentLengthToWeight(1000, 0, 1.24), null);
  assert.equal(filamentLengthToWeight(1000, 1.75, 0), null);
  assert.equal(filamentLengthToWeight(-1, 1.75, 1.24), null);
});

test("length-only G-code returns factual length without assumed weight", () => {
  const parsed = parseSlicerMetadata([
    ";TIME:3600",
    ";Filament used: 1.5m"
  ].join("\n"));

  assert.equal(parsed.timeSeconds, 3600);
  assert.equal(parsed.filamentMm, 1500);
  assert.equal(parsed.filamentGrams, null);
  assert.equal(parsed.filamentWeightSource, null);
});

test("prefers direct slicer-reported weight when weight and length are present", () => {
  const parsed = parseSlicerMetadata([
    "; estimated printing time (normal mode) = 1h 2m 3s",
    "; filament used [mm] = 4321",
    "; filament used [g] = 12.34"
  ].join("\n"));

  assert.equal(parsed.timeSeconds, 3723);
  assert.equal(parsed.filamentMm, 4321);
  assert.equal(parsed.filamentGrams, 12.34);
  assert.equal(parsed.filamentWeightSource, "slicer");
});

test("changing selected density changes a length-derived weight", () => {
  const lengthMm = parseSlicerMetadata("; filament used [mm] = 1000").filamentMm;
  const plaWeight = filamentLengthToWeight(lengthMm, 1.75, 1.24);
  const petgWeight = filamentLengthToWeight(lengthMm, 1.75, 1.27);

  closeTo(plaWeight, 2.9825495255018097);
  closeTo(petgWeight, 3.05470798176395);
  assert.ok(petgWeight > plaWeight);
});

test("parses a single-extruder Cura length", () => {
  const parsed = parseSlicerMetadata(fixture("cura-single.gcode"));

  assert.equal(parsed.timeSeconds, 567);
  closeTo(parsed.filamentMm, 1035.8);
  assert.deepEqual(parsed.filamentMmByExtruder, [1035.8]);
  assert.equal(parsed.filamentGrams, null);
});

test("preserves the existing explicit-gram single-material pattern", () => {
  const parsed = parseSlicerMetadata("; Filament used: 12.5g");

  assert.equal(parsed.filamentGrams, 12.5);
  assert.deepEqual(parsed.filamentGramsByExtruder, [12.5]);
  assert.equal(parsed.filamentMm, null);
});

test("sums Cura dual-extruder values and prefers explicit weight", () => {
  const parsed = parseSlicerMetadata(fixture("cura-dual.gcode"));

  closeTo(parsed.filamentMm, 3145.59);
  closeTo(parsed.filamentGrams, 0.9728376470947266);
  assert.equal(parsed.filamentMmByExtruder.length, 2);
  closeTo(parsed.filamentMmByExtruder[0], 0);
  closeTo(parsed.filamentMmByExtruder[1], 3145.59);
  assert.deepEqual(parsed.filamentGramsByExtruder, [0.9321797058105469, 0.04065794128417968]);
  assert.equal(parsed.filamentWeightSource, "slicer");
});

test("parses PrusaSlicer single-extruder metadata", () => {
  const parsed = parseSlicerMetadata(fixture("prusa-single.gcode"));

  assert.equal(parsed.filamentMm, 1200);
  assert.equal(parsed.filamentGrams, 3.6);
  assert.equal(parsed.timeSeconds, 2530);
});

test("sums PrusaSlicer two-extruder length and weight lists", () => {
  const parsed = parseSlicerMetadata(fixture("prusa-dual.gcode"));

  assert.equal(parsed.filamentMm, 1550);
  assert.equal(parsed.filamentGrams, 4.7);
  assert.deepEqual(parsed.filamentMmByExtruder, [1200, 350]);
  assert.deepEqual(parsed.filamentGramsByExtruder, [3.6, 1.1]);
});

test("handles OrcaSlicer whitespace, decimals, and an explicit total without double-counting", () => {
  const parsed = parseSlicerMetadata(fixture("orca-dual.gcode"));

  closeTo(parsed.filamentMm, 1550.75);
  assert.equal(parsed.filamentGrams, 4.7);
  assert.deepEqual(parsed.filamentMmByExtruder, [1200.5, 350.25, 0]);
  assert.deepEqual(parsed.filamentGramsByExtruder, [3.61, 1.09, 0]);
  assert.equal(parsed.timeSeconds, 3723);
});

test("parses Bambu Studio total length and total weight fields", () => {
  const parsed = parseSlicerMetadata(fixture("bambu-single.gcode"));

  assert.equal(parsed.filamentMm, 14664.38);
  assert.equal(parsed.filamentGrams, 43.25);
  assert.deepEqual(parsed.filamentMmByExtruder, []);
  assert.deepEqual(parsed.filamentGramsByExtruder, []);
  assert.equal(parsed.filamentWeightSource, "slicer");
});

test("keeps valid values from partially malformed metadata and ignores invalid entries", () => {
  const parsed = parseSlicerMetadata(fixture("malformed-filament.gcode"));

  assert.equal(parsed.filamentMm, 1550);
  assert.deepEqual(parsed.filamentMmByExtruder, [1200, 350]);
  assert.equal(parsed.filamentGrams, null);
  assert.equal(parsed.timeSeconds, 120);
});

test("returns null totals and empty value lists when filament metadata is missing", () => {
  const parsed = parseSlicerMetadata(fixture("missing-filament.gcode"));

  assert.equal(parsed.filamentMm, null);
  assert.equal(parsed.filamentGrams, null);
  assert.deepEqual(parsed.filamentMmByExtruder, []);
  assert.deepEqual(parsed.filamentGramsByExtruder, []);
  assert.equal(parsed.timeSeconds, 900);
});

class SimulatedFile {
  constructor({ size, startText = "", endText = "", fullText = "" }) {
    this.size = size;
    this.startText = startText;
    this.endText = endText;
    this.fullText = fullText;
    this.slices = [];
  }

  slice(start, end) {
    this.slices.push([start, end]);
    return {
      text: async () => {
        if (start === 0 && end === this.size) return this.fullText;
        if (start === 0) return this.startText;
        if (end === this.size) return this.endText;
        return "";
      }
    };
  }
}

test("reads a small G-code safely through Blob.slice", async () => {
  const file = new Blob([";TIME:3600\n; filament used [g] = 12.5\n"]);
  const parsed = await parseFile(file);

  assert.equal(parsed.timeSeconds, 3600);
  assert.equal(parsed.filamentGrams, 12.5);
  assert.equal(parsed.scanStrategy, "full");
  assert.equal(parsed.bytesRead, file.size);
});

test("finds complete metadata located only at the start", async () => {
  const file = new SimulatedFile({
    size: 40 * 1024 * 1024,
    startText: ";TIME:1200\n; filament used [mm] = 1000\n"
  });
  const parsed = await parseFile(file);

  assert.equal(parsed.timeSeconds, 1200);
  assert.equal(parsed.filamentMm, 1000);
  assert.equal(parsed.scanStrategy, "edges");
  assert.equal(file.slices.length, 2);
});

test("finds complete metadata located only at the end", async () => {
  const file = new SimulatedFile({
    size: 40 * 1024 * 1024,
    endText: "; estimated printing time = 2h\n; filament used [g] = 8.25\n"
  });
  const parsed = await parseFile(file);

  assert.equal(parsed.timeSeconds, 7200);
  assert.equal(parsed.filamentGrams, 8.25);
  assert.equal(parsed.scanStrategy, "edges");
});

test("uses a capped full fallback for a normal file when edge metadata is incomplete", async () => {
  const file = new SimulatedFile({
    size: 2 * 1024 * 1024,
    fullText: ";TIME:900\n; filament used [g] = 4.5\n"
  });
  const parsed = await parseFile(file, {
    headBytes: 64 * 1024,
    tailBytes: 64 * 1024,
    fullScanMaxBytes: 4 * 1024 * 1024
  });

  assert.equal(parsed.timeSeconds, 900);
  assert.equal(parsed.filamentGrams, 4.5);
  assert.equal(parsed.scanStrategy, "full-fallback");
  assert.ok(file.slices.some(([start, end]) => start === 0 && end === file.size));
});

test("keeps simulated large-file reads bounded to edge slices", async () => {
  const file = new SimulatedFile({ size: 500 * 1024 * 1024 });
  const parsed = await parseFile(file);

  assert.equal(parsed.metadataFound, false);
  assert.equal(parsed.scanStrategy, "expanded-edges");
  assert.equal(parsed.scanLimited, true);
  assert.ok(file.slices.every(([start, end]) => !(start === 0 && end === file.size)));
  assert.ok(Math.max(...file.slices.map(([start, end]) => end - start)) <= 2 * 1024 * 1024);
});

test("returns no metadata for a malformed non-empty file", async () => {
  const parsed = await parseFile(new Blob(["G1 X10 Y20\nnot metadata\n"]));

  assert.equal(parsed.metadataFound, false);
  assert.equal(parsed.timeSeconds, null);
  assert.equal(parsed.filamentGrams, null);
  assert.equal(parsed.filamentMm, null);
});

test("rejects empty and excessively large files with useful error codes", async () => {
  await assert.rejects(parseFile(new Blob([])), { code: "EMPTY_FILE" });

  const tooLarge = new SimulatedFile({ size: 2049 });
  await assert.rejects(parseFile(tooLarge, { maxFileBytes: 2048 }), { code: "FILE_TOO_LARGE" });
  assert.equal(tooLarge.slices.length, 0);
});
