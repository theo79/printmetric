// gcode.js


const GCODE = (() => {
  const MASS_PER_METER_175_PLA = 2.9825495255018097; // computed from π*(0.175/2 cm)^2 * 100 cm/m * 1.24 g/cm3

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

  function parseSlicerMetadata(text) {
    const lines = String(text || "").split(/\r?\n/);

    let timeSeconds = null;
    let filamentGrams = null;
    let filamentMm = null;

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

      // Cura-style: "Filament used: 3.21m" and similar
      if (filamentMm == null || filamentGrams == null) {
        const mCuraLen = comment.match(/filament\s+used\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)\s*(mm|m)\b/i);
        if (mCuraLen) {
          const value = Number(mCuraLen[1]);
          const unit = mCuraLen[2].toLowerCase();
          if (Number.isFinite(value) && value >= 0) {
            const mm = unit === "m" ? value * 1000 : value;
            if (filamentMm == null) filamentMm = mm;
          }
        }
      }

      if (filamentGrams == null) {
        const mCuraG = comment.match(/filament\s+(?:used|weight)\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)\s*g\b/i);
        if (mCuraG) {
          const g = Number(mCuraG[1]);
          if (Number.isFinite(g) && g >= 0) {
            filamentGrams = g;
          }
        }
      }

      // PrusaSlicer / SuperSlicer / Orca / Bambu family often emit:
      // "filament used [mm] = ...", "filament used [m] = ...", "filament used [g] = ..."
      if (filamentMm == null || filamentGrams == null) {
        const mBracket = comment.match(/(?:total\s+)?filament\s+used\s*\[(mm|m|g)\]\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)/i);
        if (mBracket) {
          const unit = mBracket[1].toLowerCase();
          const value = Number(mBracket[2]);
          if (Number.isFinite(value) && value >= 0) {
            if (unit === "g" && filamentGrams == null) {
              filamentGrams = value;
            } else if ((unit === "mm" || unit === "m") && filamentMm == null) {
              filamentMm = unit === "m" ? value * 1000 : value;
            }
          }
        }
      }

      // Fallback generic keys with explicit units
      if (filamentMm == null || filamentGrams == null) {
        const mGeneric = comment.match(/(?:filament\s*(?:used|length|total)|material\s*(?:used|length))\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)\s*(mm|m|g)\b/i);
        if (mGeneric) {
          const value = Number(mGeneric[1]);
          const unit = mGeneric[2].toLowerCase();
          if (Number.isFinite(value) && value >= 0) {
            if (unit === "g" && filamentGrams == null) {
              filamentGrams = value;
            }
            if ((unit === "mm" || unit === "m") && filamentMm == null) {
              filamentMm = unit === "m" ? value * 1000 : value;
            }
          }
        }
      }

      // If all found, no need to continue scanning
      if (timeSeconds != null && filamentGrams != null && filamentMm != null) {
        break;
      }
    }

    // Derive grams from mm when grams are missing
    if (filamentGrams == null && filamentMm != null) {
      filamentGrams = (filamentMm / 1000) * MASS_PER_METER_175_PLA;
    }

    return {
      timeSeconds: Number.isFinite(timeSeconds) ? timeSeconds : null,
      filamentGrams: Number.isFinite(filamentGrams) ? filamentGrams : null,
      filamentMm: Number.isFinite(filamentMm) ? filamentMm : null
    };
  }

  async function parseFile(file) {
    const text = await file.text();
    const parsed = parseSlicerMetadata(text);
    const hours = parsed.timeSeconds != null ? (parsed.timeSeconds / 3600) : null;

    return {
      timeSeconds: parsed.timeSeconds,
      filamentGrams: parsed.filamentGrams,
      filamentMm: parsed.filamentMm,
      printTimeHours: hours
    };
  }

  return {
    isGcodeFilename,
    parseFile
  };
})();
