(function (root, factory) {
  const gcode = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = gcode;
  }

  root.GCODE = gcode;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {

  const DEFAULT_FILE_SCAN_OPTIONS = Object.freeze({
    headBytes: 256 * 1024,
    tailBytes: 512 * 1024,
    expandedHeadBytes: 1024 * 1024,
    expandedTailBytes: 2 * 1024 * 1024,
    fullScanMaxBytes: 16 * 1024 * 1024,
    maxFileBytes: 2 * 1024 * 1024 * 1024
  });

  class GcodeFileError extends Error {
    constructor(code, message) {
      super(message);
      this.name = "GcodeFileError";
      this.code = code;
    }
  }

  function isGcodeFilename(name = "") {
    const lower = (name || "").toLowerCase().trim();
    return lower.endsWith(".gcode") || lower.endsWith(".gco") || lower.endsWith(".g");
  }

  function parseDurationToSeconds(value) {
    if (!value) return null;
    const text = String(value).trim();

    if (/^\d+(?:\.\d+)?$/.test(text)) {
      const sec = Number(text);
      return Number.isFinite(sec) ? sec : null;
    }

    let total = 0;
    const d = text.match(/(\d+(?:\.\d+)?)\s*d/i);
    const h = text.match(/(\d+(?:\.\d+)?)\s*h/i);
    const m = text.match(/(\d+(?:\.\d+)?)\s*m(?!m)/i);
    const s = text.match(/(\d+(?:\.\d+)?)\s*s/i);

    if (d) total += Number(d[1]) * 86400;
    if (h) total += Number(h[1]) * 3600;
    if (m) total += Number(m[1]) * 60;
    if (s) total += Number(s[1]);

    return total > 0 ? total : null;
  }

  function filamentLengthToWeight(lengthMm, diameterMm, densityGPerCm3) {
    const length = Number(lengthMm);
    const diameter = Number(diameterMm);
    const density = Number(densityGPerCm3);

    if (!Number.isFinite(length) || length < 0
      || !Number.isFinite(diameter) || diameter <= 0
      || !Number.isFinite(density) || density <= 0) {
      return null;
    }

    const radiusMm = diameter / 2;
    const volumeMm3 = Math.PI * (radiusMm ** 2) * length;
    const volumeCm3 = volumeMm3 / 1000;
    return volumeCm3 * density;
  }

  function metadataPayload(value) {
    return String(value || "").split(";", 1)[0].trim();
  }

  function parseNumericValues(value) {
    const matches = metadataPayload(value).match(/[-+]?(?:\d+(?:\.\d+)?|\.\d+)/g) || [];
    return matches
      .map(Number)
      .filter((item) => Number.isFinite(item) && item >= 0);
  }

  function parseLengthValuesWithUnits(value) {
    const valuesMm = [];
    const pattern = /([-+]?(?:\d+(?:\.\d+)?|\.\d+))\s*(mm|m)\b/gi;
    const payload = metadataPayload(value);
    let match;

    while ((match = pattern.exec(payload)) != null) {
      const amount = Number(match[1]);
      if (!Number.isFinite(amount) || amount < 0) continue;
      valuesMm.push(match[2].toLowerCase() === "m" ? amount * 1000 : amount);
    }

    return valuesMm;
  }

  function parseWeightValuesWithUnits(value) {
    const valuesGrams = [];
    const pattern = /([-+]?(?:\d+(?:\.\d+)?|\.\d+))\s*(?:g|gram|grams)\b/gi;
    const payload = metadataPayload(value);
    let match;

    while ((match = pattern.exec(payload)) != null) {
      const amount = Number(match[1]);
      if (Number.isFinite(amount) && amount >= 0) valuesGrams.push(amount);
    }

    return valuesGrams;
  }

  function sumValues(values) {
    return values.reduce((total, value) => total + value, 0);
  }

  function parseSlicerMetadata(text) {
    const lines = String(text || "").split(/\r?\n/);

    let timeSeconds = null;
    let filamentGramsByExtruder = null;
    let filamentMmByExtruder = null;
    let totalFilamentGrams = null;
    let totalFilamentMm = null;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      const comment = line.replace(/^\s*[;#]\s*/, "");

      // TIME (common in Cura / many firmware previews)
      if (timeSeconds == null) {
        const mTime = comment.match(/^(?:time|time_elapsed)\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)/i);
        if (mTime) {
          const sec = Number(mTime[1]);
          if (Number.isFinite(sec) && sec >= 0) {
            timeSeconds = sec;
          }
        }
      }

      // PrusaSlicer / SuperSlicer / Orca / Bambu style estimated time strings
      if (timeSeconds == null) {
        const mEst = comment.match(/estimated\s+printing\s+time(?:\s*\([^)]*\))?\s*[:=]\s*(.+)$/i);
        if (mEst) {
          const sec = parseDurationToSeconds(mEst[1]);
          if (sec != null) {
            timeSeconds = sec;
          }
        }
      }

      // Some slicers emit explicit seconds key
      if (timeSeconds == null) {
        const mSec = comment.match(/estimated\s+printing\s+time\s*\(s\)\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)/i);
        if (mSec) {
          const sec = Number(mSec[1]);
          if (Number.isFinite(sec) && sec >= 0) {
            timeSeconds = sec;
          }
        }
      }

      // Cura emits a unit on each value, for example: "Filament used: 0m, 3.14m".
      if (filamentMmByExtruder == null) {
        const mCuraLength = comment.match(/^filament\s+used\s*[:=]\s*(.+)$/i);
        if (mCuraLength) {
          const values = parseLengthValuesWithUnits(mCuraLength[1]);
          if (values.length > 0) filamentMmByExtruder = values;

          if (filamentGramsByExtruder == null) {
            const weightValues = parseWeightValuesWithUnits(mCuraLength[1]);
            if (weightValues.length > 0) filamentGramsByExtruder = weightValues;
          }
        }
      }

      // Cura's filament_weight placeholder is a gram list, commonly wrapped in brackets.
      if (filamentGramsByExtruder == null) {
        const mCuraWeight = comment.match(/^filament\s+weight\s*[:=]\s*(.+)$/i);
        if (mCuraWeight) {
          const values = parseNumericValues(mCuraWeight[1]);
          if (values.length > 0) filamentGramsByExtruder = values;
        }
      }

      // PrusaSlicer / OrcaSlicer / Bambu Studio style unit-bearing keys.
      // A "total" field is an alternative aggregate, not another extruder to add.
      const mBracket = comment.match(/^(total\s+)?filament\s+(?:used|length|weight)\s*\[(mm|m|g)\]\s*[:=]\s*(.+)$/i);
      if (mBracket) {
        const isTotal = Boolean(mBracket[1]);
        const unit = mBracket[2].toLowerCase();
        const values = parseNumericValues(mBracket[3]);

        if (values.length > 0) {
          const normalized = unit === "m" ? values.map((item) => item * 1000) : values;
          const total = sumValues(normalized);

          if (unit === "g") {
            if (isTotal && totalFilamentGrams == null) totalFilamentGrams = total;
            if (!isTotal && filamentGramsByExtruder == null) filamentGramsByExtruder = normalized;
          } else {
            if (isTotal && totalFilamentMm == null) totalFilamentMm = total;
            if (!isTotal && filamentMmByExtruder == null) filamentMmByExtruder = normalized;
          }
        }
      }

      // Fallback for generic metadata only when each value carries an explicit unit.
      if (filamentMmByExtruder == null) {
        const mGenericLength = comment.match(/^(?:filament|material)\s+(?:used|length|total)\s*[:=]\s*(.+)$/i);
        if (mGenericLength) {
          const values = parseLengthValuesWithUnits(mGenericLength[1]);
          if (values.length > 0) filamentMmByExtruder = values;

          if (filamentGramsByExtruder == null) {
            const weightValues = parseWeightValuesWithUnits(mGenericLength[1]);
            if (weightValues.length > 0) filamentGramsByExtruder = weightValues;
          }
        }
      }
    }

    const filamentGrams = totalFilamentGrams != null
      ? totalFilamentGrams
      : (filamentGramsByExtruder ? sumValues(filamentGramsByExtruder) : null);
    const filamentMm = totalFilamentMm != null
      ? totalFilamentMm
      : (filamentMmByExtruder ? sumValues(filamentMmByExtruder) : null);

    return {
      timeSeconds: Number.isFinite(timeSeconds) ? timeSeconds : null,
      filamentGrams: Number.isFinite(filamentGrams) ? filamentGrams : null,
      filamentMm: Number.isFinite(filamentMm) ? filamentMm : null,
      filamentWeightSource: Number.isFinite(filamentGrams) ? "slicer" : null,
      filamentGramsByExtruder: filamentGramsByExtruder ? [...filamentGramsByExtruder] : [],
      filamentMmByExtruder: filamentMmByExtruder ? [...filamentMmByExtruder] : []
    };
  }

  function positiveByteOption(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
  }

  function fileScanOptions(options = {}) {
    return {
      headBytes: positiveByteOption(options.headBytes, DEFAULT_FILE_SCAN_OPTIONS.headBytes),
      tailBytes: positiveByteOption(options.tailBytes, DEFAULT_FILE_SCAN_OPTIONS.tailBytes),
      expandedHeadBytes: positiveByteOption(options.expandedHeadBytes, DEFAULT_FILE_SCAN_OPTIONS.expandedHeadBytes),
      expandedTailBytes: positiveByteOption(options.expandedTailBytes, DEFAULT_FILE_SCAN_OPTIONS.expandedTailBytes),
      fullScanMaxBytes: positiveByteOption(options.fullScanMaxBytes, DEFAULT_FILE_SCAN_OPTIONS.fullScanMaxBytes),
      maxFileBytes: positiveByteOption(options.maxFileBytes, DEFAULT_FILE_SCAN_OPTIONS.maxFileBytes)
    };
  }

  function hasFilamentMetadata(parsed) {
    return parsed.filamentGrams != null || parsed.filamentMm != null;
  }

  function hasCompleteLikelyMetadata(parsed) {
    return parsed.timeSeconds != null && hasFilamentMetadata(parsed);
  }

  async function readEdgeText(file, headBytes, tailBytes) {
    const size = file.size;
    if (size <= headBytes + tailBytes) {
      return {
        text: await file.slice(0, size).text(),
        bytesRead: size,
        coveredWholeFile: true
      };
    }

    const tailStart = Math.max(headBytes, size - tailBytes);
    const [head, tail] = await Promise.all([
      file.slice(0, headBytes).text(),
      file.slice(tailStart, size).text()
    ]);

    return {
      text: `${head}\n${tail}`,
      bytesRead: headBytes + (size - tailStart),
      coveredWholeFile: false
    };
  }

  function fileParseResult(parsed, details) {
    const hours = parsed.timeSeconds != null ? (parsed.timeSeconds / 3600) : null;

    return {
      timeSeconds: parsed.timeSeconds,
      filamentGrams: parsed.filamentGrams,
      filamentMm: parsed.filamentMm,
      filamentWeightSource: parsed.filamentWeightSource,
      filamentGramsByExtruder: parsed.filamentGramsByExtruder,
      filamentMmByExtruder: parsed.filamentMmByExtruder,
      printTimeHours: hours,
      metadataFound: parsed.timeSeconds != null || hasFilamentMetadata(parsed),
      ...details
    };
  }

  async function parseFile(file, options = {}) {
    if (!file || !Number.isFinite(Number(file.size)) || typeof file.slice !== "function") {
      throw new GcodeFileError("INVALID_FILE", "The selected file could not be read.");
    }

    const size = Number(file.size);
    const scan = fileScanOptions(options);

    if (size === 0) {
      throw new GcodeFileError("EMPTY_FILE", "The selected G-code file is empty.");
    }
    if (size > scan.maxFileBytes) {
      throw new GcodeFileError(
        "FILE_TOO_LARGE",
        `This G-code file is too large to inspect safely (limit ${Math.round(scan.maxFileBytes / (1024 ** 3))} GiB).`
      );
    }

    let sampled = await readEdgeText(file, scan.headBytes, scan.tailBytes);
    let parsed = parseSlicerMetadata(sampled.text);
    let scanStrategy = sampled.coveredWholeFile ? "full" : "edges";
    let bytesRead = sampled.bytesRead;

    if (!hasCompleteLikelyMetadata(parsed) && !sampled.coveredWholeFile) {
      if (size <= scan.fullScanMaxBytes) {
        const text = await file.slice(0, size).text();
        parsed = parseSlicerMetadata(text);
        bytesRead += size;
        scanStrategy = "full-fallback";
        sampled = { coveredWholeFile: true };
      } else {
        const expandedHead = Math.max(scan.headBytes, scan.expandedHeadBytes);
        const expandedTail = Math.max(scan.tailBytes, scan.expandedTailBytes);
        const expanded = await readEdgeText(file, expandedHead, expandedTail);
        parsed = parseSlicerMetadata(expanded.text);
        bytesRead += expanded.bytesRead;
        scanStrategy = "expanded-edges";
      }
    }

    return fileParseResult(parsed, {
      fileSize: size,
      bytesRead,
      scanStrategy,
      scanLimited: scanStrategy === "expanded-edges"
    });
  }

  return {
    isGcodeFilename,
    parseDurationToSeconds,
    parseNumericValues,
    parseSlicerMetadata,
    filamentLengthToWeight,
    parseFile,
    DEFAULT_FILE_SCAN_OPTIONS,
    GcodeFileError
  };
});
