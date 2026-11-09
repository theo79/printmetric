// Approximate average printing power consumption values for cost estimates only.
// These are not maximum PSU ratings; actual consumption varies with bed temperature, nozzle temperature, material, ambient conditions, and printer settings.
const PRINTERS = [
  { name: "Bambu Lab A1 Mini", powerW: 90 },
  { name: "Bambu Lab A1", powerW: 180 },
  { name: "Bambu Lab P1P", powerW: 250 },
  { name: "Bambu Lab P1S", powerW: 270 },
  { name: "Bambu Lab X1 Carbon", powerW: 300 },
  { name: "Prusa MINI+", powerW: 80 },
  { name: "Prusa MK3S+", powerW: 100 },
  { name: "Prusa MK4S", powerW: 140 },
  { name: "Prusa CORE One", powerW: 180 },
  { name: "Creality Ender-3 V2 / Neo", powerW: 120 },
  { name: "Creality Ender-3 V3 SE", powerW: 150 },
  { name: "Creality Ender-3 V3 KE", powerW: 180 },
  { name: "Creality K1", powerW: 220 },
  { name: "Creality K1C", powerW: 230 },
  { name: "Creality K1 Max", powerW: 290 },
  { name: "Creality CR-10", powerW: 150 },
  { name: "Elegoo Neptune 3", powerW: 120 },
  { name: "Elegoo Neptune 4", powerW: 180 },
  { name: "Elegoo Neptune 4 Pro", powerW: 220 },
  { name: "Elegoo Neptune 4 Plus", powerW: 260 },
  { name: "Elegoo Neptune 4 Max", powerW: 290 },
  { name: "Anycubic Kobra", powerW: 120 },
  { name: "Anycubic Kobra 2", powerW: 150 },
  { name: "Anycubic Kobra 2 Pro", powerW: 190 },
  { name: "Anycubic Kobra 3", powerW: 220 },
  { name: "Artillery Sidewinder X1", powerW: 200 },
  { name: "Artillery Sidewinder X2", powerW: 230 }
];

const MATERIAL_PRESETS = [
  { value: "pla", label: "PLA", density: 1.24 },
  { value: "petg", label: "PETG", density: 1.27 },
  { value: "abs", label: "ABS", density: 1.04 },
  { value: "asa", label: "ASA", density: 1.07 },
  { value: "tpu", label: "TPU", density: 1.21 },
  { value: "nylon", label: "Nylon (PA)", density: 1.14 },
  { value: "pc", label: "PC", density: 1.20 },
  { value: "custom", label: "Other / Custom", density: null }
];

function $(id) {
  return document.getElementById(id);
}

function fmtMoney(n) {
  return Number.isFinite(n) ? n.toFixed(2) : "—";
}

function setText(id, text) {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
}

function animateMoneyText(id, currencyPrefix, value, durationMs = 450) {
  const el = $(id);
  if (!el) return;
  if (!Number.isFinite(value)) return;

  const reduceMotion = typeof window !== "undefined"
    && window.matchMedia
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const startValue = Number(el.dataset.animValue);
  const from = Number.isFinite(startValue) ? startValue : value;
  const to = value;

  if (reduceMotion || from === to) {
    el.textContent = `${currencyPrefix}${fmtMoney(to)}`;
    el.dataset.animValue = String(to);
    return;
  }

  if (el.__countUpRaf) {
    cancelAnimationFrame(el.__countUpRaf);
  }

  const startTime = performance.now();
  const tick = (now) => {
    const progress = Math.min(1, (now - startTime) / durationMs);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = from + (to - from) * eased;
    el.textContent = `${currencyPrefix}${fmtMoney(current)}`;

    if (progress < 1) {
      el.__countUpRaf = requestAnimationFrame(tick);
    } else {
      el.dataset.animValue = String(to);
      el.__countUpRaf = null;
    }
  };

  el.__countUpRaf = requestAnimationFrame(tick);
}

const STORAGE_KEY_PREFIX = "printmetric_";
const PROFILES_STORAGE_KEY = "printmetric_profiles";
const THEME_STORAGE_KEY = "printmetric_theme";
const CUSTOMER_JOB_FIELD_IDS = ["customerName", "jobName", "quoteNotes"];
let timeFromGcode = false;
let filamentFromGcode = false;
let importedFilamentLengthMm = null;
let importedFilamentWeightSource = null;
let importedTimeSeconds = null;
let importedFileName = null;
let importedSlicerName = null;
let donateNoteTimer = null;
let latestCalculationResult = null;
let gcodeImportSequence = 0;

const PROFILE_FIELD_IDS = [
  "filamentCostPerKg",
  "electricityCost",
  "machineWearCost",
  "setupLaborMins",
  // Legacy field ID retained as the per-unit labor value.
  "handsOnLaborMins",
  "laborCostPerHour",
  // Legacy field ID retained so existing profiles continue to load.
  "profitMargin",
  "failureWasteAllowance",
  "avgPower",
  "printerType",
  "materialType",
  "filamentDensity",
  "minimumPrice",
  "quantity"
];

const PERSISTED_FIELD_IDS = [
  ...CUSTOMER_JOB_FIELD_IDS,
  "sellerBusinessName",
  "sellerContactDetails",
  "quoteNumber",
  "quoteDate",
  "quoteValidUntil",
  "filamentCostPerKg",
  "electricityCost",
  "machineWearCost",
  "setupLaborMins",
  "handsOnLaborMins",
  "laborCostPerHour",
  "profitMargin",
  "failureWasteAllowance",
  "quantity",
  "minimumPrice",
  "usdPerEur",
  "avgPower",
  "materialType",
  "filamentDiameter",
  "filamentDensity",
  "filamentUsedGrams",
  "printTimeHours",
  "printerType"
];

function storageKey(id) {
  return `${STORAGE_KEY_PREFIX}${id}`;
}

function getEffectiveTheme() {
  const rootAttr = document.documentElement.getAttribute("data-theme");
  if (rootAttr === "dark" || rootAttr === "light") return rootAttr;
  const prefersDark = typeof window !== "undefined"
    && window.matchMedia
    && window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "dark" || theme === "light") {
    root.setAttribute("data-theme", theme);
  } else {
    root.removeAttribute("data-theme");
  }

  const effective = getEffectiveTheme();
  const btn = $("btnThemeToggle");
  if (btn) {
    btn.setAttribute("aria-pressed", effective === "dark" ? "true" : "false");
  }
  setText("themeToggleText", effective === "dark" ? "Switch to light mode" : "Switch to dark mode");
}

function setupTheme() {
  try {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === "dark" || savedTheme === "light") {
      applyTheme(savedTheme);
    } else {
      applyTheme(null);
    }
  } catch (err) {
    applyTheme(null);
  }

  $("btnThemeToggle")?.addEventListener("click", () => {
    const nextTheme = getEffectiveTheme() === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch (err) {
      // Ignore storage errors in private mode.
    }
  });
}

function openDialogModal({
  title = "Confirm Action",
  message = "",
  inputLabel = "",
  initialValue = "",
  showInput = false,
  confirmText = "Confirm",
  cancelText = "Cancel",
  danger = false,
  fallback = null
} = {}) {
  const dialog = $("appDialog");
  const titleEl = $("dialogTitle");
  const msgEl = $("dialogMessage");
  const inputWrap = $("dialogInputWrap");
  const inputLabelEl = $("dialogInputLabel");
  const inputEl = $("dialogInput");
  const confirmBtn = $("btnDialogConfirm");
  const cancelBtn = $("btnDialogCancel");
  const form = $("dialogForm");

  if (!dialog || typeof dialog.showModal !== "function" || !form || !confirmBtn || !cancelBtn) {
    return Promise.resolve(typeof fallback === "function" ? fallback() : null);
  }

  if (dialog.open) {
    dialog.close();
  }

  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;
  if (inputWrap) inputWrap.hidden = !showInput;
  if (inputLabelEl && inputLabel) inputLabelEl.textContent = inputLabel;
  if (inputEl) {
    inputEl.value = initialValue;
  }

  confirmBtn.textContent = confirmText;
  confirmBtn.className = danger ? "btn-danger" : "btn-accent";
  cancelBtn.textContent = cancelText;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (dialog.open) dialog.close();
      resolve(result);
    };

    const onCancelClick = () => finish(showInput ? null : false);
    const onDialogClose = () => finish(showInput ? null : false);
    const onSubmit = (e) => {
      e.preventDefault();
      if (showInput) {
        finish(inputEl ? inputEl.value : "");
      } else {
        finish(true);
      }
    };

    function cleanup() {
      cancelBtn.removeEventListener("click", onCancelClick);
      dialog.removeEventListener("close", onDialogClose);
      dialog.removeEventListener("cancel", onCancelClick);
      form.removeEventListener("submit", onSubmit);
    }

    cancelBtn.addEventListener("click", onCancelClick);
    dialog.addEventListener("close", onDialogClose);
    dialog.addEventListener("cancel", onCancelClick);
    form.addEventListener("submit", onSubmit);

    dialog.showModal();
    if (showInput && inputEl) {
      inputEl.focus();
      inputEl.select();
    } else {
      confirmBtn.focus();
    }
  });
}

function persistFieldValue(id) {
  const el = $(id);
  if (!el) return;
  try {
    localStorage.setItem(storageKey(id), el.value ?? "");
  } catch (err) {
    console.warn("Could not persist field:", id, err);
  }
}

function setupPersistence() {
  PERSISTED_FIELD_IDS.forEach((id) => {
    const el = $(id);
    if (!el) return;

    el.addEventListener("input", () => persistFieldValue(id));
    el.addEventListener("change", () => persistFieldValue(id));
  });
}

function restorePersistedFields() {
  const printerType = $("printerType");
  const materialType = $("materialType");
  try {
    const savedPrinterType = localStorage.getItem(storageKey("printerType"));
    const savedMaterialType = localStorage.getItem(storageKey("materialType"));
    const savedAvgPower = localStorage.getItem(storageKey("avgPower"));
    const savedDensity = localStorage.getItem(storageKey("filamentDensity"));

    PERSISTED_FIELD_IDS.forEach((id) => {
      if (id === "printerType" || id === "materialType") return;

      const el = $(id);
      if (!el) return;

      const savedValue = localStorage.getItem(storageKey(id));
      if (savedValue != null) {
        el.value = savedValue;
      }
    });

    if (savedMaterialType != null && materialType) {
      materialType.value = savedMaterialType;
      materialType.dispatchEvent(new Event("change"));
      if (savedDensity != null) {
        $("filamentDensity").value = savedDensity;
        persistFieldValue("filamentDensity");
      }
    } else if (materialType && !materialType.value) {
      materialType.value = "pla";
      materialType.dispatchEvent(new Event("change"));
    }

    if (savedPrinterType != null && printerType) {
      printerType.value = savedPrinterType;
      printerType.dispatchEvent(new Event("change"));

      if (savedAvgPower != null) {
        $("avgPower").value = savedAvgPower;
        persistFieldValue("avgPower");
      }
    }
  } catch (err) {
    // Fail silently when storage is unavailable.
  }
}

function clearCustomerJobData() {
  CUSTOMER_JOB_FIELD_IDS.forEach((id) => {
    const field = $(id);
    if (field) field.value = "";
    try {
      localStorage.removeItem(storageKey(id));
    } catch (err) {
      console.warn("Could not clear local customer/job field:", id, err);
    }
  });

  syncPrintQuoteDetails();
  setText("localDataStatus", "Customer name, job name and notes were cleared from this browser.");
}

async function resetAllLocalData() {
  const message =
    "Reset all PrintMetric data stored in this browser? This deletes current inputs, customer/job information, settings and all saved profiles.";
  const confirmed = await openDialogModal({
    title: "Reset all local data",
    message,
    confirmText: "Reset all data",
    danger: true,
    fallback: () => confirm(message)
  });
  if (!confirmed) return;

  try {
    const ownedKeys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && key.startsWith(STORAGE_KEY_PREFIX)) ownedKeys.push(key);
    }
    ownedKeys.forEach((key) => localStorage.removeItem(key));
    window.location.reload();
  } catch (err) {
    console.warn("Could not reset local PrintMetric data:", err);
    setText("localDataStatus", "PrintMetric could not clear local data in this browser.");
  }
}

function setupLocalDataControls() {
  $("btnClearCustomerJob")?.addEventListener("click", clearCustomerJobData);
  $("btnResetLocalData")?.addEventListener("click", resetAllLocalData);
}

function localIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function setDefaultQuoteDate() {
  const quoteDate = $("quoteDate");
  if (quoteDate && !quoteDate.value) {
    quoteDate.value = localIsoDate();
    persistFieldValue("quoteDate");
  }
}

function validateQuoteDates({ showErrors = false } = {}) {
  const result = QUOTE.validateDateRange(rawValue("quoteDate"), rawValue("quoteValidUntil"));
  const quoteDate = $("quoteDate");
  const validUntil = $("quoteValidUntil");
  const shouldShow = showErrors && !result.valid;

  [quoteDate, validUntil].forEach((input) => {
    if (!input) return;
    input.classList.toggle("input-invalid", shouldShow);
    input.setAttribute("aria-invalid", shouldShow ? "true" : "false");
  });
  setText("quoteDateStatus", shouldShow ? result.message : "");
  return result;
}

function setupQuoteDateValidation() {
  [$("quoteDate"), $("quoteValidUntil")].forEach((input) => {
    input?.addEventListener("change", () => validateQuoteDates({ showErrors: true }));
  });
}

function loadProfiles() {
  try {
    const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
    if (Array.isArray(parsed)) {
      const migrated = {};
      parsed.forEach((item) => {
        if (item && typeof item === "object" && typeof item.name === "string" && item.profile && typeof item.profile === "object") {
          migrated[item.name] = item.profile;
        }
      });
      return migrated;
    }
    return {};
  } catch (err) {
    return {};
  }
}

function saveProfiles(profiles) {
  try {
    const valueToSave = (profiles && typeof profiles === "object" && !Array.isArray(profiles)) ? profiles : {};
    localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(valueToSave));
    return true;
  } catch (err) {
    return false;
  }
}

function refreshProfileSelect() {
  const select = $("profileSelect");
  if (!select) return;

  const previousSelection = select.value;
  const profiles = loadProfiles();
  const names = Object.keys(profiles).sort((a, b) => a.localeCompare(b));

  select.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select profile…";
  placeholder.selected = true;
  select.appendChild(placeholder);

  names.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  });

  if (previousSelection && names.includes(previousSelection)) {
    select.value = previousSelection;
  }
}

function applyProfile(profileObj) {
  if (!profileObj || typeof profileObj !== "object") return;

  PROFILE_FIELD_IDS.forEach((fieldId) => {
    if (fieldId === "printerType" || fieldId === "avgPower") return;
    if (!(fieldId in profileObj)) return;

    const el = $(fieldId);
    if (!el) return;
    el.value = profileObj[fieldId] ?? "";
    persistFieldValue(fieldId);
  });

  const printerTypeEl = $("printerType");
  const materialTypeEl = $("materialType");
  const avgPowerEl = $("avgPower");

  if (printerTypeEl && profileObj.printerType != null) {
    printerTypeEl.value = profileObj.printerType;
    printerTypeEl.dispatchEvent(new Event("change"));
    persistFieldValue("printerType");
  }

  if (materialTypeEl && profileObj.materialType != null) {
    materialTypeEl.value = profileObj.materialType;
    materialTypeEl.dispatchEvent(new Event("change"));
    persistFieldValue("materialType");
    if (profileObj.filamentDensity != null) {
      $("filamentDensity").value = profileObj.filamentDensity;
      persistFieldValue("filamentDensity");
    }
  }

  if (avgPowerEl) {
    if (profileObj.printerType === "other") {
      const otherPowerW = profileObj.otherPowerW ?? profileObj.avgPower;
      if (otherPowerW != null) {
        avgPowerEl.value = otherPowerW;
      }
    } else if (profileObj.avgPower != null) {
      avgPowerEl.value = profileObj.avgPower;
    }
    persistFieldValue("avgPower");
  }
}

function captureCurrentProfile() {
  const profile = {};

  PROFILE_FIELD_IDS.forEach((fieldId) => {
    const el = $(fieldId);
    if (!el) return;
    profile[fieldId] = el.value ?? "";
  });

  if (profile.printerType === "other") {
    profile.otherPowerW = $("avgPower")?.value ?? "";
  }

  return profile;
}

function populateMaterials() {
  const sel = $("materialType");
  if (!sel) return;

  sel.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select material…";
  placeholder.selected = true;
  sel.appendChild(placeholder);

  MATERIAL_PRESETS.forEach((material) => {
    const opt = document.createElement("option");
    opt.value = material.value;
    opt.textContent = material.label;
    sel.appendChild(opt);
  });

  const saved = localStorage.getItem(storageKey("materialType"));
  if (saved && [...sel.options].some((option) => option.value === saved)) {
    sel.value = saved;
  } else {
    sel.value = "pla";
  }
}

function setupMaterialChange() {
  const materialType = $("materialType");
  const density = $("filamentDensity");
  if (!materialType || !density) return;

  materialType.addEventListener("change", (e) => {
    const val = e.target.value;
    if (val === "" || val === "custom") {
      persistFieldValue("materialType");
      updateEstimatedFilamentFromImportedLength();
      return;
    }

    const preset = MATERIAL_PRESETS.find((material) => material.value === val);
    if (preset && preset.density != null) {
      density.value = String(preset.density);
      persistFieldValue("filamentDensity");
    }

    persistFieldValue("materialType");
    updateEstimatedFilamentFromImportedLength();
  });
}

function setupProfiles() {
  const select = $("profileSelect");
  const saveBtn = $("btnSaveProfile");
  const deleteBtn = $("btnDeleteProfile");
  if (!select || !saveBtn || !deleteBtn) return;

  refreshProfileSelect();

  select.addEventListener("change", () => {
    const selectedName = select.value;
    if (!selectedName) return;
    const profiles = loadProfiles();
    const found = profiles[selectedName];
    if (found && typeof found === "object") {
      applyProfile(found);
      onCalculate();
    }
  });

  saveBtn.addEventListener("click", async () => {
    const enteredName = await openDialogModal({
      title: "Save Profile",
      message: "Enter a name to save the current printer, material, and shop rate settings.",
      inputLabel: "Profile name",
      initialValue: select.value || "",
      showInput: true,
      confirmText: "Save profile",
      fallback: () => prompt("Profile name:", select.value || "")
    });
    const name = enteredName ? enteredName.trim() : "";
    if (!name) return;

    const profiles = loadProfiles();
    if (profiles[name]) {
      const overwrite = await openDialogModal({
        title: "Overwrite Profile",
        message: `Profile "${name}" already exists. Overwrite it with current values?`,
        confirmText: "Overwrite",
        fallback: () => confirm(`Profile "${name}" already exists. Overwrite?`)
      });
      if (!overwrite) return;
    }

    const profile = captureCurrentProfile();
    profiles[name] = profile;

    if (!saveProfiles(profiles)) {
      setText("localDataStatus", "Could not save profile in this browser.");
      return;
    }

    refreshProfileSelect();
    select.value = name;
    onCalculate();
  });

  deleteBtn.addEventListener("click", async () => {
    const selectedName = select.value;
    if (!selectedName) return;

    const confirmed = await openDialogModal({
      title: "Delete Profile",
      message: `Delete saved profile "${selectedName}"?`,
      confirmText: "Delete profile",
      danger: true,
      fallback: () => confirm(`Delete profile "${selectedName}"?`)
    });
    if (!confirmed) return;

    const profiles = loadProfiles();
    if (!profiles[selectedName]) return;

    delete profiles[selectedName];

    if (!saveProfiles(profiles)) {
      setText("localDataStatus", "Could not delete profile.");
      return;
    }

    refreshProfileSelect();
  });
}

function populatePrinters() {
  const sel = $("printerType");
  sel.innerHTML = "";

  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = "Select a printer…";
  ph.disabled = true;
  ph.hidden = true;
  ph.selected = true;
  sel.appendChild(ph);

  PRINTERS.forEach((p, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = p.name;
    sel.appendChild(opt);
  });

  const oth = document.createElement("option");
  oth.value = "other";
  oth.textContent = "Other (enter power manually)";
  sel.appendChild(oth);

  $("avgPower").value = "";
  $("avgPower").readOnly = false;
}

function setupPrinterChange() {
  $("printerType").addEventListener("change", (e) => {
    const val = e.target.value;
    const avgPower = $("avgPower");

    avgPower.readOnly = false;

    if (val === "" || val === undefined) {
      avgPower.value = "";
      persistFieldValue("avgPower");
      persistFieldValue("printerType");
      return;
    }

    if (val === "other") {
      if (!avgPower.value) avgPower.focus();
      persistFieldValue("printerType");
      return;
    }

    const idx = parseInt(val, 10);
    const p = PRINTERS[idx];
    if (p) {
      avgPower.value = p.powerW;
    } else {
      avgPower.value = "";
    }

    persistFieldValue("avgPower");
    persistFieldValue("printerType");
  });
}

function formatParsedTime(timeSeconds) {
  if (!Number.isFinite(timeSeconds)) return null;
  const totalMinutes = Math.round(timeSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function isSupportedSlicerFile(name = "") {
  const lower = (name || "").toLowerCase().trim();
  return GCODE.isGcodeFilename(lower) || lower.endsWith(".3mf");
}

async function detectSlicerFromFile(file) {
  const lowerName = (file?.name || "").toLowerCase();
  if (lowerName.endsWith(".3mf")) return "3MF Project";
  try {
    const headChunk = await file.slice(0, 16384).text();
    const tailStart = Math.max(0, Number(file.size || 0) - 16384);
    const tailChunk = tailStart > 0 ? await file.slice(tailStart, file.size).text() : "";
    const sample = `${headChunk}\n${tailChunk}`;
    if (/BambuStudio|Bambu Studio/i.test(sample)) return "Bambu Studio";
    if (/OrcaSlicer/i.test(sample)) return "OrcaSlicer";
    if (/PrusaSlicer/i.test(sample)) return "PrusaSlicer";
    if (/SuperSlicer/i.test(sample)) return "SuperSlicer";
    if (/Cura_SteamEngine|UltiMaker Cura|FLAVOR:Marlin/i.test(sample)) return "Cura";
  } catch (err) {
    // Ignore slicer sniffing failure.
  }
  return "G-code";
}

async function parse3mfFile(file) {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder("utf-8");
  const extractedTexts = [];

  let offset = 0;
  while (offset + 30 <= buffer.byteLength) {
    if (view.getUint32(offset, true) !== 0x04034b50) break;
    const flags = view.getUint16(offset + 6, true);
    if ((flags & 0x08) !== 0) break;
    const compression = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const entryName = decoder.decode(bytes.subarray(offset + 30, offset + 30 + nameLen));
    const dataStart = offset + 30 + nameLen + extraLen;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buffer.byteLength) break;

    if (/(slice_info\.config|Slic3r_pe\.config|\.gcode)$/i.test(entryName) && compressedSize > 0) {
      const slice = bytes.subarray(dataStart, dataEnd);
      if (compression === 0) {
        extractedTexts.push(decoder.decode(slice));
      } else if (compression === 8 && typeof DecompressionStream !== "undefined") {
        const stream = new Blob([slice]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        extractedTexts.push(await new Response(stream).text());
      }
    }
    offset = dataEnd;
  }

  const combined = extractedTexts.join("\n");
  const parsed = GCODE.parseSlicerMetadata(combined);

  if (parsed.timeSeconds == null) {
    const predMatch = combined.match(/key="prediction"\s+value="(\d+(?:\.\d+)?)"/i);
    if (predMatch) parsed.timeSeconds = Number(predMatch[1]);
  }
  if (parsed.filamentGrams == null) {
    const weights = [];
    const weightRegex = /\bused_g="(\d+(?:\.\d+)?)"/gi;
    let m;
    while ((m = weightRegex.exec(combined)) !== null) {
      weights.push(Number(m[1]));
    }
    if (weights.length > 0) {
      parsed.filamentGrams = weights.reduce((a, b) => a + b, 0);
      parsed.filamentWeightSource = "slicer";
    }
  }
  if (parsed.filamentMm == null) {
    const lengthsM = [];
    const lenRegex = /\bused_m="(\d+(?:\.\d+)?)"/gi;
    let m;
    while ((m = lenRegex.exec(combined)) !== null) {
      lengthsM.push(Number(m[1]) * 1000);
    }
    if (lengthsM.length > 0) {
      parsed.filamentMm = lengthsM.reduce((a, b) => a + b, 0);
    }
  }

  return {
    ...parsed,
    printTimeHours: parsed.timeSeconds != null ? parsed.timeSeconds / 3600 : null,
    scanLimited: false
  };
}

function updateGcodeLoadedBadge({ grams = null } = {}) {
  const badge = $("gcodeLoadedBadge");
  if (!badge) return;

  const parsedTime = formatParsedTime(importedTimeSeconds);
  const stats = [];
  if (parsedTime) stats.push(parsedTime);
  if (Number.isFinite(grams)) stats.push(`${grams.toFixed(1)} g`);
  else if (Number.isFinite(importedFilamentLengthMm)) stats.push(`${(importedFilamentLengthMm / 1000).toFixed(2)} m`);

  if (!importedFileName || stats.length === 0) {
    badge.hidden = true;
    return;
  }

  setText("gcodeBadgeSlicer", importedSlicerName || "G-code");
  setText("gcodeBadgeFilename", importedFileName);
  setText("gcodeBadgeStats", stats.join(" • "));
  badge.hidden = false;
}

function setGcodeImportStatus({ grams = null, source = null, keptManualValue = false, scanLimited = false } = {}) {
  const parts = [];
  const parsedTime = formatParsedTime(importedTimeSeconds);
  if (parsedTime) parts.push(parsedTime);

  if (Number.isFinite(grams)) {
    const sourceText = source === "slicer"
      ? "weight reported by slicer"
      : "estimated from filament length";
    parts.push(`${grams.toFixed(1)}g (${sourceText})`);
  } else if (Number.isFinite(importedFilamentLengthMm)) {
    parts.push(`${importedFilamentLengthMm.toFixed(1)}mm filament length`);
  }

  updateGcodeLoadedBadge({ grams });

  if (parts.length === 0) {
    const scope = scanLimited ? " in the sampled beginning or end" : "";
    setText("gcodeStatus", `No supported G-code metadata was found${scope}; use manual inputs.`);
    return;
  }

  const suffix = keptManualValue
    ? "; kept manual filament weight"
    : (source === "estimated" && !Number.isFinite(grams)
      ? "; enter a valid diameter and density to estimate weight"
      : "");
  setText("gcodeStatus", `Parsed: ${parts.join(", ")}${suffix}`);
}

function updateEstimatedFilamentFromImportedLength({ updateCalculation = true } = {}) {
  if (!filamentFromGcode
    || importedFilamentWeightSource !== "estimated"
    || !Number.isFinite(importedFilamentLengthMm)) {
    return null;
  }

  const grams = GCODE.filamentLengthToWeight(
    importedFilamentLengthMm,
    $("filamentDiameter")?.value,
    $("filamentDensity")?.value
  );

  if (!Number.isFinite(grams)) {
    setGcodeImportStatus({ source: "estimated" });
    return null;
  }

  const filamentInput = $("filamentUsedGrams");
  filamentInput.value = Number(grams.toFixed(2));
  persistFieldValue("filamentUsedGrams");
  setGcodeImportStatus({ grams, source: "estimated" });

  if (updateCalculation) {
    onCalculate();
  }

  return grams;
}

function clearGcodeImport() {
  importedTimeSeconds = null;
  importedFilamentLengthMm = null;
  importedFilamentWeightSource = null;
  importedFileName = null;
  importedSlicerName = null;
  timeFromGcode = false;
  filamentFromGcode = false;

  const fileInput = $("gcodeFile");
  if (fileInput) fileInput.value = "";

  const badge = $("gcodeLoadedBadge");
  if (badge) badge.hidden = true;

  const timeInput = $("printTimeHours");
  const filamentInput = $("filamentUsedGrams");
  if (timeInput) {
    timeInput.value = "";
    persistFieldValue("printTimeHours");
  }
  if (filamentInput) {
    filamentInput.value = "";
    persistFieldValue("filamentUsedGrams");
  }

  setText("gcodeStatus", "Cleared imported slicer metadata.");
  onCalculate();
}

function validateAndParseGcode(file) {
  const importSequence = ++gcodeImportSequence;
  const fileInput = $("gcodeFile");
  if (fileInput) fileInput.value = "";

  if (!isSupportedSlicerFile(file?.name)) {
    setText("gcodeStatus", "Please upload a valid G-code (.gcode, .gco, .g) or .3mf file.");
    return;
  }

  setText("gcodeStatus", "Parsing G-code…");

  const is3mf = (file?.name || "").toLowerCase().endsWith(".3mf");
  const parsePromise = is3mf ? parse3mfFile(file) : GCODE.parseFile(file);

  Promise.all([parsePromise, detectSlicerFromFile(file)]).then(([
    {
      timeSeconds,
      printTimeHours,
      filamentGrams,
      filamentMm,
      filamentWeightSource,
      scanLimited
    },
    slicerName
  ]) => {
    if (importSequence !== gcodeImportSequence) return;
    let didUpdate = false;
    const timeInput = $("printTimeHours");
    const filamentInput = $("filamentUsedGrams");
    const canSetTime = !timeInput?.value || timeFromGcode;
    const canSetFilament = !filamentInput?.value || filamentFromGcode;
    const parsedTimeSeconds = Number.isFinite(timeSeconds)
      ? timeSeconds
      : (Number.isFinite(printTimeHours) ? printTimeHours * 3600 : null);
    let parsedFilamentGrams = Number.isFinite(filamentGrams) ? filamentGrams : null;
    importedTimeSeconds = parsedTimeSeconds;
    importedFilamentLengthMm = Number.isFinite(filamentMm) ? filamentMm : null;
    importedFileName = file?.name || "Uploaded file";
    importedSlicerName = slicerName;

    if (canSetTime && printTimeHours != null && !Number.isNaN(printTimeHours)) {
      timeInput.value = Number(printTimeHours.toFixed(2));
      timeFromGcode = true;
      persistFieldValue("printTimeHours");
      didUpdate = true;
    }

    if (canSetFilament && filamentWeightSource === "slicer" && Number.isFinite(filamentGrams)) {
      filamentInput.value = Number(filamentGrams.toFixed(2));
      filamentFromGcode = true;
      importedFilamentLengthMm = Number.isFinite(filamentMm) ? filamentMm : null;
      importedFilamentWeightSource = "slicer";
      persistFieldValue("filamentUsedGrams");
      didUpdate = true;
    }

    if (canSetFilament && !Number.isFinite(filamentGrams) && Number.isFinite(filamentMm)) {
      importedFilamentLengthMm = filamentMm;
      importedFilamentWeightSource = "estimated";
      filamentFromGcode = true;
      parsedFilamentGrams = updateEstimatedFilamentFromImportedLength({ updateCalculation: false });
      didUpdate = Number.isFinite(parsedFilamentGrams);
    }

    if (!canSetFilament && Number.isFinite(filamentMm) && !Number.isFinite(parsedFilamentGrams)) {
      parsedFilamentGrams = GCODE.filamentLengthToWeight(
        filamentMm,
        $("filamentDiameter")?.value,
        $("filamentDensity")?.value
      );
    }

    const statusSource = Number.isFinite(filamentGrams) ? "slicer"
      : (Number.isFinite(filamentMm) ? "estimated" : null);
    setGcodeImportStatus({
      grams: parsedFilamentGrams,
      source: statusSource,
      keptManualValue: !canSetFilament && statusSource != null,
      scanLimited
    });

    if (didUpdate) {
      onCalculate();
    }
  }).catch((err) => {
    if (importSequence !== gcodeImportSequence) return;
    console.error("G-code parse error:", err);
    setText("gcodeStatus", err?.message || "The G-code file could not be read; use manual inputs.");
  });
}

function setupGcodeUpload() {
  const fileInput = $("gcodeFile");
  const dropzone = $("gcodeDropzone");

  fileInput?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    validateAndParseGcode(file);
  });

  if (dropzone && fileInput) {
    dropzone.addEventListener("click", (e) => {
      if (e.target === fileInput) return;
      fileInput.click();
    });

    dropzone.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fileInput.click();
      }
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add("drag-active");
      });
    });

    ["dragleave", "dragend"].forEach((eventName) => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove("drag-active");
      });
    });

    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove("drag-active");
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      validateAndParseGcode(file);
    });
  }

  $("btnClearGcode")?.addEventListener("click", clearGcodeImport);

  $("printTimeHours").addEventListener("input", () => {
    timeFromGcode = false;
  });

  $("filamentUsedGrams").addEventListener("input", () => {
    filamentFromGcode = false;
    importedFilamentWeightSource = null;
  });

  $("filamentDiameter").addEventListener("input", () => {
    updateEstimatedFilamentFromImportedLength();
  });

  $("filamentDensity").addEventListener("input", () => {
    updateEstimatedFilamentFromImportedLength();
  });
}

function calculateTotalsEUR() {
  return PRICING.calculatePricing(getPricingFormInput());
}

const VALIDATION_FIELD_IDS = {
  filamentG: "filamentUsedGrams",
  filamentCostPerKg: "filamentCostPerKg",
  hours: "printTimeHours",
  avgPowerW: "avgPower",
  kwhRate: "electricityCost",
  wear: "machineWearCost",
  setupLaborMins: "setupLaborMins",
  laborMinsPerUnit: "handsOnLaborMins",
  laborPerHour: "laborCostPerHour",
  markupPct: "profitMargin",
  wasteAllowancePct: "failureWasteAllowance",
  quantity: "quantity",
  minimumOrderPrice: "minimumPrice",
  filamentDiameter: "filamentDiameter",
  materialDensity: "filamentDensity",
  usdPerEur: "usdPerEur"
};

function rawValue(id) {
  return $(id)?.value ?? "";
}

function getPricingFormInput() {
  return {
    filamentG: rawValue("filamentUsedGrams"),
    filamentCostPerKg: rawValue("filamentCostPerKg"),
    hours: rawValue("printTimeHours"),
    avgPowerW: rawValue("avgPower"),
    kwhRate: rawValue("electricityCost"),
    wear: rawValue("machineWearCost"),
    setupLaborMins: rawValue("setupLaborMins"),
    laborMinsPerUnit: rawValue("handsOnLaborMins"),
    laborPerHour: rawValue("laborCostPerHour"),
    markupPct: rawValue("profitMargin"),
    wasteAllowancePct: rawValue("failureWasteAllowance"),
    quantity: rawValue("quantity"),
    minimumOrderPrice: rawValue("minimumPrice")
  };
}

function getValidationInput() {
  return {
    ...getPricingFormInput(),
    filamentDiameter: rawValue("filamentDiameter"),
    materialDensity: rawValue("filamentDensity"),
    usdPerEur: rawValue("usdPerEur")
  };
}

function validationMessageElement(input) {
  const id = `${input.id}Error`;
  let message = $(id);
  if (!message) {
    message = document.createElement("small");
    message.id = id;
    message.className = "validation-message";
    message.setAttribute("aria-live", "polite");
    input.insertAdjacentElement("afterend", message);
  }
  return message;
}

function validateForm({ showAll = false } = {}) {
  const result = PRICING.validatePricingInput(getValidationInput(), {
    validatePhysicalInputs: true,
    usdEnabled: true,
    requireQuantity: true
  });

  Object.entries(VALIDATION_FIELD_IDS).forEach(([name, id]) => {
    const input = $(id);
    if (!input) return;
    const error = result.errors[name];
    const shouldShow = Boolean(error) && (showAll || input.dataset.validationTouched === "true" || input.value !== "");
    const message = validationMessageElement(input);
    if (input.dataset.validationBaseDescribedby == null) {
      input.dataset.validationBaseDescribedby = input.getAttribute("aria-describedby") || "";
    }
    const describedBy = [input.dataset.validationBaseDescribedby, shouldShow ? message.id : ""]
      .filter(Boolean)
      .join(" ");
    input.classList.toggle("input-invalid", shouldShow);
    input.setAttribute("aria-invalid", shouldShow ? "true" : "false");
    if (describedBy) input.setAttribute("aria-describedby", describedBy);
    else input.removeAttribute("aria-describedby");
    message.textContent = shouldShow ? error : "";
  });

  const blockingErrors = Object.keys(result.errors).filter((name) => name !== "usdPerEur");
  return { ...result, blockingErrors };
}

function clearOutputs() {
  latestCalculationResult = null;
  setText("outTotalEUR", "—");
  setText("outTotalUSD", "—");
  setText("outUnitPill", "€ — / unit");
  setText("fxStatus", "");
  setText("outMinPriceNote", "");

  setText("outFilamentCost", "—");
  setText("outEnergyKwh", "—");
  setText("outElectricityCost", "—");
  setText("outSetupLaborCost", "—");
  setText("outPerUnitLaborTotal", "—");
  setText("outLaborCost", "—");
  setText("outWearCost", "—");
  setText("outSubtotalCost", "—");
  setText("outFailureWasteAllowance", "—");
  setText("outAdjustedCost", "—");
  setText("outProfitCost", "—");
  setText("outFinalCost", "—");
  setText("outQuantity", "—");
  setText("outGrandTotal", "—");

  const animatedIds = ["outTotalEUR", "outTotalUSD", "outGrandTotal"];
  animatedIds.forEach((id) => {
    const el = $(id);
    if (!el) return;
    if (el.__countUpRaf) {
      cancelAnimationFrame(el.__countUpRaf);
      el.__countUpRaf = null;
    }
    delete el.dataset.animValue;
  });

  setText("psTotalEUR", "—");
  setText("psUnitPriceEUR", "—");
  setText("psTotalUSD", "—");
  setText("psUnitPriceUSD", "—");
  setText("psMaterial", "—");
  setText("psPrinter", "—");
  setText("psQuantity", "—");
  setText("psTime", "—");
  setText("psMinPriceNote", "");
  setText("psFxNote", "");
}

function setBreakdownOutputsEUR(breakdown) {
  setText("outUnitPill", `€ ${fmtMoney(breakdown.effectiveUnitPrice)} / unit`);
  setText("outFilamentCost", `€ ${fmtMoney(breakdown.filamentCostTotal)}`);
  setText("outEnergyKwh", `${fmtMoney(breakdown.energyKwhTotal)} kWh`);
  setText("outElectricityCost", `€ ${fmtMoney(breakdown.electricityCostTotal)}`);
  setText("outSetupLaborCost", `€ ${fmtMoney(breakdown.setupLaborCost)}`);
  setText("outPerUnitLaborTotal", `€ ${fmtMoney(breakdown.perUnitLaborTotal)}`);
  setText("outLaborCost", `€ ${fmtMoney(breakdown.laborCost)}`);
  setText("outWearCost", `€ ${fmtMoney(breakdown.wearCostTotal)}`);
  setText("outSubtotalCost", `€ ${fmtMoney(breakdown.orderSubtotal)}`);
  setText("outFailureWasteAllowance", `€ ${fmtMoney(breakdown.wasteAllowanceAmount)}`);
  setText("outAdjustedCost", `€ ${fmtMoney(breakdown.adjustedCost)}`);
  setText("outProfitCost", `€ ${fmtMoney(breakdown.markupAmount)}`);
  setText("outFinalCost", `€ ${fmtMoney(breakdown.effectiveUnitPrice)}`);
  setText("outQuantity", `${breakdown.quantity}`);
  animateMoneyText("outGrandTotal", "€ ", breakdown.displayedTotalEUR);
}

function syncPrintQuoteDetails() {
  const sellerBusinessName = ($("sellerBusinessName")?.value || "").trim();
  const sellerContactDetails = ($("sellerContactDetails")?.value || "").trim();
  const quoteNumber = ($("quoteNumber")?.value || "").trim();
  const quoteDate = ($("quoteDate")?.value || "").trim();
  const quoteValidUntil = ($("quoteValidUntil")?.value || "").trim();
  const customerName = ($("customerName")?.value || "").trim();
  const jobName = ($("jobName")?.value || "").trim();
  const quoteNotes = ($("quoteNotes")?.value || "").trim();

  setText("psSellerBusinessName", sellerBusinessName || "—");
  setText("psSellerContactDetails", sellerContactDetails);
  setText("psQuoteNumber", quoteNumber || "—");
  setText("psQuoteDate", quoteDate || "—");
  setText("psQuoteValidUntil", quoteValidUntil || "—");
  setText("psCustomerName", customerName);
  setText("psJobName", jobName);
  setText("psQuoteNotes", quoteNotes);

  const hasCustomer = customerName.length > 0;
  const hasJob = jobName.length > 0;
  const hasNotes = quoteNotes.length > 0;

  if ($("psCustomerRow")) $("psCustomerRow").hidden = !hasCustomer;
  if ($("psJobRow")) $("psJobRow").hidden = !hasJob;
  if ($("psNotesRow")) $("psNotesRow").hidden = !hasNotes;
  if ($("psQuoteBlock")) $("psQuoteBlock").hidden = !(hasCustomer || hasJob || hasNotes);
  if ($("psSellerBlock")) $("psSellerBlock").hidden = !(sellerBusinessName || sellerContactDetails);
}

function showDonateNoteBriefly() {
  const note = $("donateNote");
  if (!note) return;

  note.hidden = false;
  note.classList.add("show");

  if (donateNoteTimer) {
    clearTimeout(donateNoteTimer);
  }

  donateNoteTimer = setTimeout(() => {
    note.classList.remove("show");
    note.hidden = true;
    donateNoteTimer = null;
  }, 6000);
}

// EUR is the base currency. USD conversion uses only the locally entered manual rate.
function onCalculate(options = {}) {
  const { showValidation = false, silent = false } = options;
  $("fxStatus").textContent = "";
  $("outMinPriceNote").textContent = "";
  $("psMinPriceNote").textContent = "";
  syncPrintQuoteDetails();

  const validation = validateForm({ showAll: showValidation });
  if (validation.blockingErrors.length > 0) {
    clearOutputs();
    const hasTouchedField = document.querySelector('[data-validation-touched="true"]');
    if (showValidation || hasTouchedField) {
      setText("calculationStatus", "Calculation unavailable. Correct the highlighted numeric fields.");
    }
    return;
  }

  const breakdown = calculateTotalsEUR();
  if (breakdown == null) {
    clearOutputs();
    return;
  }
  latestCalculationResult = breakdown;

  const minimumApplied = breakdown.minimumOrderPriceApplied;
  const displayedTotalEUR = breakdown.displayedTotalEUR;
  const fxRate = Number($("usdPerEur")?.value);

  animateMoneyText("outTotalEUR", "€ ", displayedTotalEUR);
  setBreakdownOutputsEUR(breakdown);
  if (!silent) {
    showDonateNoteBriefly();
  }
  if (minimumApplied) {
    $("outMinPriceNote").textContent = "Applied minimum order price";
    $("psMinPriceNote").textContent = "Applied minimum order price";
  }

  if (!Number.isFinite(fxRate) || fxRate <= 0) {
    setText("outTotalUSD", "—");
    setText("psTotalUSD", "—");
    setText("fxStatus", "USD disabled (invalid rate)");
    setText("calculationStatus", `Order total € ${fmtMoney(displayedTotalEUR)}. USD conversion is unavailable because the exchange rate is invalid.`);
    return;
  }

  const totalUSD = PRICING.convertEurToUsd(displayedTotalEUR, fxRate);

  animateMoneyText("outTotalUSD", "$ ", totalUSD);
  setText("psTotalUSD", `$ ${fmtMoney(totalUSD)}`);
  setText("fxStatus", `Manual rate: 1 EUR = ${fxRate.toFixed(4)} USD`);
  setText("calculationStatus", `Order total € ${fmtMoney(displayedTotalEUR)}. USD total $ ${fmtMoney(totalUSD)}.`);
}

function setupLiveCalculate() {
  const handleInstantCalculate = (e) => {
    const target = e.target;
    if (!target || target.id === "gcodeFile" || target.id === "profileSelect") return;
    if (target.type === "number") {
      target.dataset.validationTouched = "true";
    }
    onCalculate({ silent: true });
  };

  document.querySelectorAll(".form-column input, .form-column select, .form-column textarea").forEach((control) => {
    if (control.id === "gcodeFile" || control.id === "profileSelect") return;
    control.addEventListener("input", handleInstantCalculate);
    control.addEventListener("change", handleInstantCalculate);
  });
}

async function onExportPdf() {
  const quoteDateValidation = validateQuoteDates({ showErrors: true });
  if (!quoteDateValidation.valid) {
    $("quoteValidUntil")?.focus();
    return;
  }
  if (!latestCalculationResult) {
    const proceed = await openDialogModal({
      title: "Export Uncalculated Quote?",
      message: "You haven't calculated a total yet. Export the quote PDF anyway?",
      confirmText: "Export anyway",
      fallback: () => confirm("You haven't calculated a total yet. Export anyway?")
    });
    if (!proceed) return;
  }

  const quantity = latestCalculationResult?.quantity ?? Number($("quantity")?.value);
  const displayedTotalEUR = latestCalculationResult?.displayedTotalEUR ?? 0;
  const displayedUnitEUR = Number.isFinite(displayedTotalEUR) && quantity > 0 ? displayedTotalEUR / quantity : 0;
  const fxRate = Number($("usdPerEur")?.value);

  $("psTotalEUR").textContent = `€ ${fmtMoney(displayedTotalEUR)}`;
  $("psUnitPriceEUR").textContent = `€ ${fmtMoney(displayedUnitEUR)}`;
  $("psMinPriceNote").textContent = $("outMinPriceNote").textContent || "";

  if (Number.isFinite(fxRate) && fxRate > 0) {
    $("psTotalUSD").textContent = `Converted USD: $ ${fmtMoney(displayedTotalEUR * fxRate)}`;
    $("psUnitPriceUSD").textContent = `Converted USD: $ ${fmtMoney(displayedUnitEUR * fxRate)}`;
    $("psFxNote").textContent = `Manual conversion rate: 1 EUR = ${fxRate.toFixed(4)} USD. Not automatically updated.`;
  } else {
    $("psTotalUSD").textContent = "—";
    $("psUnitPriceUSD").textContent = "—";
    $("psFxNote").textContent = "USD conversion unavailable: enter a valid manual EUR→USD rate.";
  }

  $("psMaterial").textContent = $("materialType").selectedOptions[0]?.textContent || "—";
  $("psPrinter").textContent = $("printerType").selectedOptions[0]?.textContent || "—";
  $("psQuantity").textContent = String(quantity);
  $("psTime").textContent = $("printTimeHours").value
    ? `${$("printTimeHours").value} h`
    : "—";

  syncPrintQuoteDetails();
  $("psTimestamp").textContent = new Date().toLocaleString();

  window.print();
}

function buildQuoteSummaryText() {
  const timestamp = new Date().toLocaleString();
  const calc = latestCalculationResult;
  const fxRate = Number($("usdPerEur")?.value);
  const convertedUsd = calc ? PRICING.convertEurToUsd(calc.displayedTotalEUR, fxRate) : null;

  const totalEUR = calc ? `€ ${fmtMoney(calc.displayedTotalEUR)}` : "—";
  const totalUSD = Number.isFinite(convertedUsd) ? `$ ${fmtMoney(convertedUsd)}` : "—";
  const unitPriceEUR = calc ? `€ ${fmtMoney(calc.effectiveUnitPrice)}` : "";
  const quantity = calc ? String(calc.quantity) : ($("quantity")?.value?.trim() || "");
  const grandTotal = calc ? `€ ${fmtMoney(calc.displayedTotalEUR)}` : "";
  const printer = $("printerType")?.selectedOptions?.[0]?.textContent?.trim() || "";
  const filamentG = $("filamentUsedGrams")?.value?.trim() || "";
  const printTimeH = $("printTimeHours")?.value?.trim() || "";
  const markup = $("profitMargin")?.value?.trim() || "";
  const usdPerEur = $("usdPerEur")?.value?.trim() || "";

  const lines = [
    "PrintMetric",
    `Timestamp: ${timestamp}`,
    `Base total (EUR): ${totalEUR}`,
    `Converted total (USD): ${totalUSD}`
  ];

  if (unitPriceEUR) {
    lines.push(`Effective unit price (EUR): ${unitPriceEUR}`);
  }
  if (quantity && quantity !== "—") {
    lines.push(`Quantity: ${quantity}`);
  }
  if (grandTotal && grandTotal !== "—") {
    lines.push(`Grand total: ${grandTotal}`);
  }
  if (printer && printer !== "Select a printer…") {
    lines.push(`Printer: ${printer}`);
  }
  if (filamentG) {
    lines.push(`Filament used: ${filamentG} g`);
  }
  if (printTimeH) {
    lines.push(`Print time: ${printTimeH} h`);
  }
  if (markup) {
    lines.push(`Markup: ${markup}%`);
  }
  if (usdPerEur) {
    lines.push(`Manual FX rate: ${usdPerEur} USD per EUR`);
  }

  lines.push("Made with PrintMetric — Know your real print cost.");
  return lines.join("\n");
}

async function copyTextToClipboard(text) {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  ta.style.pointerEvents = "none";
  document.body.appendChild(ta);
  ta.select();

  let ok = false;
  try {
    ok = document.execCommand("copy");
  } finally {
    document.body.removeChild(ta);
  }
  return ok;
}

async function onCopySummary() {
  const btn = $("btnCopySummary");
  const originalText = btn?.textContent || "Copy quote summary";
  const summary = buildQuoteSummaryText();

  let copied = false;
  try {
    copied = await copyTextToClipboard(summary);
  } catch (err) {
    copied = false;
  }

  if (btn) {
    btn.textContent = copied ? "Copied!" : "Copy failed";
    setTimeout(() => {
      if (btn) btn.textContent = originalText;
    }, 1200);
  }
}

function setupCalculate() {
  const calcBtn = $("btnCalculate");
  const exportBtn = $("btnExportPdf");
  const copyBtn = $("btnCopySummary");

  if (calcBtn) calcBtn.addEventListener("click", () => onCalculate({ showValidation: true }));
  if (exportBtn) exportBtn.addEventListener("click", onExportPdf);
  if (copyBtn) copyBtn.addEventListener("click", onCopySummary);
}

function boot() {
  setupTheme();
  populatePrinters();
  setupPrinterChange();
  populateMaterials();
  setupMaterialChange();
  setupGcodeUpload();
  setupProfiles();
  setupLocalDataControls();
  setupQuoteDateValidation();
  setupCalculate();
  setupLiveCalculate();
  setupPersistence();
  restorePersistedFields();
  setDefaultQuoteDate();
  onCalculate({ silent: true });
}

document.addEventListener("DOMContentLoaded", boot);
