const PRINTERS = [
  { name: "Creality Ender-3 (V2/Neo)", powerW: 120 },
  { name: "Prusa i3 MK3S+", powerW: 100 },
  { name: "Prusa MINI+", powerW: 80 },
  { name: "Anycubic Kobra", powerW: 120 },
  { name: "Creality CR-10", powerW: 150 },
  { name: "Bambu Lab P1P", powerW: 250 },
  { name: "Bambu Lab X1 Carbon", powerW: 300 },
  { name: "Anycubic i3 Mega", powerW: 120 },
  { name: "Artillery Sidewinder X1", powerW: 200 },
  { name: "Elegoo Neptune 3", powerW: 120 }
];

function $(id) {
  return document.getElementById(id);
}
function num(id) {
  const value = Number($(id).value);
  return Number.isFinite(value) ? value : 0;
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
let timeFromGcode = false;
let filamentFromGcode = false;
let donateNoteTimer = null;
const PROFILE_FIELD_IDS = [
  "filamentCostPerKg",
  "electricityCost",
  "machineWearCost",
  "handsOnLaborMins",
  "laborCostPerHour",
  "profitMargin",
  "avgPower",
  "printerType",
  "minimumPrice",
  "quantity"
];
const PERSISTED_FIELD_IDS = [
  "customerName",
  "jobName",
  "quoteNotes",
  "filamentCostPerKg",
  "electricityCost",
  "machineWearCost",
  "handsOnLaborMins",
  "laborCostPerHour",
  "profitMargin",
  "quantity",
  "minimumPrice",
  "usdPerEur",
  "avgPower",
  "filamentDiameter",
  "filamentDensity",
  "filamentUsedGrams",
  "printTimeHours",
  "printerType"
];

function storageKey(id) {
  return `${STORAGE_KEY_PREFIX}${id}`;
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
  const usdPerEur = $("usdPerEur");
  try {
    const savedPrinterType = localStorage.getItem(storageKey("printerType"));

    PERSISTED_FIELD_IDS.forEach((id) => {
      if (id === "printerType") return;

      const el = $(id);
      if (!el) return;

      const savedValue = localStorage.getItem(storageKey(id));
      if (savedValue != null) {
        el.value = savedValue;
      }
    });

    if (savedPrinterType != null && printerType) {
      printerType.value = savedPrinterType;
      printerType.dispatchEvent(new Event("change"));

      const savedAvgPower = localStorage.getItem(storageKey("avgPower"));
      if (savedAvgPower != null && savedPrinterType === "other") {
        $("avgPower").value = savedAvgPower;
      }
    }
  } catch (err) {
    // Fail silently when storage is unavailable.
  }

  if (usdPerEur) {
    const rate = Number(usdPerEur.value);
    if (!Number.isFinite(rate) || rate <= 0) {
      usdPerEur.value = "1.10";
    }
  }
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
  const avgPowerEl = $("avgPower");

  if (printerTypeEl && profileObj.printerType != null) {
    printerTypeEl.value = profileObj.printerType;
    printerTypeEl.dispatchEvent(new Event("change"));
    persistFieldValue("printerType");
  }

  if (avgPowerEl) {
    if (profileObj.printerType === "other") {
      const otherPowerW = profileObj.otherPowerW ?? profileObj.avgPower;
      if (otherPowerW != null) {
        avgPowerEl.value = otherPowerW;
      }
    } else if (profileObj.avgPower != null && profileObj.printerType == null) {
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

  saveBtn.addEventListener("click", () => {
    const enteredName = prompt("Profile name:", select.value || "");
    const name = enteredName ? enteredName.trim() : "";
    if (!name) return;

    const profiles = loadProfiles();
    if (profiles[name]) {
      const overwrite = confirm(`Profile "${name}" already exists. Overwrite?`);
      if (!overwrite) return;
    }

    const profile = captureCurrentProfile();
    profiles[name] = profile;

    if (!saveProfiles(profiles)) {
      alert("Could not save profile.");
      return;
    }

    refreshProfileSelect();
    select.value = name;
    onCalculate({ skipZeroWarning: true });
  });

  deleteBtn.addEventListener("click", () => {
    const selectedName = select.value;
    if (!selectedName) return;

    const confirmed = confirm(`Delete profile "${selectedName}"?`);
    if (!confirmed) return;

    const profiles = loadProfiles();
    if (!profiles[selectedName]) return;

    delete profiles[selectedName];

    if (!saveProfiles(profiles)) {
      alert("Could not delete profile.");
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
  $("avgPower").readOnly = true;
}

function setupPrinterChange() {
  $("printerType").addEventListener("change", (e) => {
    const val = e.target.value;
    const avgPower = $("avgPower");

    if (val === "" || val === undefined) {
      avgPower.value = "";
      avgPower.readOnly = true;
      persistFieldValue("avgPower");
      persistFieldValue("printerType");
      return;
    }

    if (val === "other") {
      avgPower.readOnly = false;
      if (!avgPower.value) avgPower.focus();
      persistFieldValue("printerType");
      return;
    }

    const idx = parseInt(val, 10);
    const p = PRINTERS[idx];
    if (p) {
      avgPower.value = p.powerW;
      avgPower.readOnly = true;
    } else {
      avgPower.value = "";
      avgPower.readOnly = true;
    }

    persistFieldValue("avgPower");
    persistFieldValue("printerType");
  });
}

function validateAndParseGcode(file) {
  if (!GCODE.isGcodeFilename(file?.name)) {
    setText("gcodeStatus", "Please upload a valid G-code file (.gcode, .gco, .g).");
    return;
  }

  setText("gcodeStatus", "Parsing G-code…");

  GCODE.parseFile(file).then(({ timeSeconds, printTimeHours, filamentGrams, filamentMm }) => {
    let didUpdate = false;
    const timeInput = $("printTimeHours");
    const filamentInput = $("filamentUsedGrams");
    const canSetTime = !timeInput?.value || timeFromGcode;
    const canSetFilament = !filamentInput?.value || filamentFromGcode;
    const parsedTimeSeconds = Number.isFinite(timeSeconds)
      ? timeSeconds
      : (Number.isFinite(printTimeHours) ? printTimeHours * 3600 : null);
    let parsedFilamentGrams = Number.isFinite(filamentGrams) ? filamentGrams : null;

    if (canSetTime && printTimeHours != null && !Number.isNaN(printTimeHours)) {
      timeInput.value = Number(printTimeHours.toFixed(2));
      timeFromGcode = true;
      persistFieldValue("printTimeHours");
      didUpdate = true;
    }

    if (canSetFilament && filamentGrams != null && !Number.isNaN(filamentGrams)) {
      filamentInput.value = Number(filamentGrams.toFixed(2));
      filamentFromGcode = true;
      persistFieldValue("filamentUsedGrams");
      didUpdate = true;
    }

    if (canSetFilament && (filamentGrams == null || Number.isNaN(filamentGrams)) && filamentMm != null && !Number.isNaN(filamentMm)) {
      const diameterMm = Number($("filamentDiameter")?.value);
      const densityGPerCm3 = Number($("filamentDensity")?.value);

      if (Number.isFinite(diameterMm) && diameterMm > 0 && Number.isFinite(densityGPerCm3) && densityGPerCm3 > 0) {
        const radiusMm = diameterMm / 2;
        const areaMm2 = Math.PI * (radiusMm ** 2);
        const volumeMm3 = areaMm2 * filamentMm;
        const volumeCm3 = volumeMm3 / 1000;
        const grams = volumeCm3 * densityGPerCm3;
        const roundedGrams = Math.round(grams * 10) / 10;

        if (Number.isFinite(roundedGrams)) {
          parsedFilamentGrams = roundedGrams;
          filamentInput.value = roundedGrams;
          filamentFromGcode = true;
          persistFieldValue("filamentUsedGrams");
          didUpdate = true;
        }
      }
    }

    if (parsedTimeSeconds != null && parsedFilamentGrams != null) {
      const totalMinutes = Math.round(parsedTimeSeconds / 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      setText("gcodeStatus", `Parsed: ${hours}h ${minutes}m, ${parsedFilamentGrams.toFixed(1)}g`);
    } else if (parsedTimeSeconds != null) {
      setText("gcodeStatus", "Parsed time only");
    } else if (parsedFilamentGrams != null) {
      setText("gcodeStatus", "Parsed filament only");
    } else {
      setText("gcodeStatus", "Could not find metadata, using manual inputs");
    }

    if (didUpdate) {
      onCalculate({ skipZeroWarning: true });
    }
  }).catch((err) => {
    console.error("G-code parse error:", err);
    setText("gcodeStatus", "Could not find metadata, using manual inputs");
  });
}

function setupGcodeUpload() {
  $("gcodeFile").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    validateAndParseGcode(file);
  });

  $("printTimeHours").addEventListener("input", () => {
    timeFromGcode = false;
  });

  $("filamentUsedGrams").addEventListener("input", () => {
    filamentFromGcode = false;
  });
}

function calculateTotalsEUR(skipZeroWarning = false) {
  const filamentG = num("filamentUsedGrams");
  const filamentCostPerKg = num("filamentCostPerKg");
  const hours = num("printTimeHours");
  const avgPowerW = num("avgPower");
  const kwhRate = num("electricityCost");
  const wear = num("machineWearCost");
  const laborMins = num("handsOnLaborMins");
  const laborPerHour = num("laborCostPerHour");
  const marginPct = num("profitMargin");
  const quantity = Math.max(1, num("quantity"));
  const minimumPrice = Math.max(0, num("minimumPrice"));

  const missingKeyValues = filamentG <= 0 || filamentCostPerKg <= 0;
  if (missingKeyValues) return null;

  const filamentCost = (filamentG / 1000) * filamentCostPerKg;
  const energyKwh = (avgPowerW > 0 && hours > 0)
    ? (avgPowerW / 1000) * hours
    : 0;
  const electricityCost = (avgPowerW > 0 && kwhRate > 0 && hours > 0)
    ? ((avgPowerW * hours) / 1000) * kwhRate
    : 0;
  const laborCost = laborPerHour * (laborMins / 60);
  const wearCost = wear;

  const subtotal = filamentCost + electricityCost + laborCost + wearCost;
  const profitAmount = subtotal * (marginPct / 100);
  const finalTotalSingle = subtotal + profitAmount;
  const finalTotal = finalTotalSingle * quantity;

  return {
    filamentCost,
    energyKwh,
    electricityCost,
    laborCost,
    wearCost,
    subtotal,
    profitAmount,
    quantity,
    minimumPrice,
    finalTotalSingle,
    finalTotal
  };
}

function clearOutputs() {
  setText("outTotalEUR", "—");
  setText("outTotalUSD", "—");
  setText("fxStatus", "");
  setText("outMinPriceNote", "");

  setText("outFilamentCost", "—");
  setText("outEnergyKwh", "—");
  setText("outElectricityCost", "—");
  setText("outLaborCost", "—");
  setText("outWearCost", "—");
  setText("outSubtotalCost", "—");
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
  setText("psTotalUSD", "—");
  setText("psMinPriceNote", "");
  setText("psFilamentCost", "—");
  setText("psEnergyKwh", "—");
  setText("psElectricityCost", "—");
  setText("psLaborCost", "—");
  setText("psWearCost", "—");
  setText("psSubtotalCost", "—");
  setText("psProfitCost", "—");
  setText("psFinalCost", "—");
  setText("psQuantity", "—");
  setText("psGrandTotal", "—");
}

function setBreakdownOutputsEUR(breakdown) {
  setText("outFilamentCost", `€ ${fmtMoney(breakdown.filamentCost)}`);
  setText("outEnergyKwh", `${fmtMoney(breakdown.energyKwh)} kWh`);
  setText("outElectricityCost", `€ ${fmtMoney(breakdown.electricityCost)}`);
  setText("outLaborCost", `€ ${fmtMoney(breakdown.laborCost)}`);
  setText("outWearCost", `€ ${fmtMoney(breakdown.wearCost)}`);
  setText("outSubtotalCost", `€ ${fmtMoney(breakdown.subtotal)}`);
  setText("outProfitCost", `€ ${fmtMoney(breakdown.profitAmount)}`);
  setText("outFinalCost", `€ ${fmtMoney(breakdown.finalTotalSingle)}`);
  setText("outQuantity", `${breakdown.quantity}`);
  animateMoneyText("outGrandTotal", "€ ", breakdown.finalTotal);

  setText("psFilamentCost", `€ ${fmtMoney(breakdown.filamentCost)}`);
  setText("psEnergyKwh", `${fmtMoney(breakdown.energyKwh)} kWh`);
  setText("psElectricityCost", `€ ${fmtMoney(breakdown.electricityCost)}`);
  setText("psLaborCost", `€ ${fmtMoney(breakdown.laborCost)}`);
  setText("psWearCost", `€ ${fmtMoney(breakdown.wearCost)}`);
  setText("psSubtotalCost", `€ ${fmtMoney(breakdown.subtotal)}`);
  setText("psProfitCost", `€ ${fmtMoney(breakdown.profitAmount)}`);
  setText("psFinalCost", `€ ${fmtMoney(breakdown.finalTotalSingle)}`);
  setText("psQuantity", `${breakdown.quantity}`);
  setText("psGrandTotal", `€ ${fmtMoney(breakdown.finalTotal)}`);
}

function syncPrintQuoteDetails() {
  const customerName = ($("customerName")?.value || "").trim();
  const jobName = ($("jobName")?.value || "").trim();
  const quoteNotes = ($("quoteNotes")?.value || "").trim();

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

// FX logic
let cachedRateEURUSD = null;
let lastRateTime = 0;
const RATE_TTL_MS = 10 * 60 * 1000;

function abortableFetch(url, ms = 5000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  return fetch(url, { signal: ctl.signal }).finally(() => clearTimeout(t));
}

async function fetchFromFrankfurter() {
  const res = await abortableFetch("https://api.frankfurter.app/latest?from=EUR&to=USD");
  if (!res.ok) throw new Error("Frankfurter not ok");
  const data = await res.json();
  return data?.rates?.USD;
}

async function fetchFromExchangerateHost() {
  const res = await abortableFetch("https://api.exchangerate.host/latest?base=EUR&symbols=USD");
  if (!res.ok) throw new Error("exchangerate.host not ok");
  const data = await res.json();
  return data?.rates?.USD;
}

async function fetchFromERAPI() {
  const res = await abortableFetch("https://open.er-api.com/v6/latest/EUR");
  if (!res.ok) throw new Error("ER-API not ok");
  const data = await res.json();
  return data?.rates?.USD;
}

async function getEURtoUSDRate() {
  const now = Date.now();
  if (cachedRateEURUSD && (now - lastRateTime) < RATE_TTL_MS) {
    return cachedRateEURUSD;
  }

  const sources = [fetchFromFrankfurter, fetchFromExchangerateHost, fetchFromERAPI];
  for (const src of sources) {
    try {
      const rate = await src();
      if (rate) {
        cachedRateEURUSD = rate;
        lastRateTime = now;
        return rate;
      }
    } catch (e) {
      console.warn("FX source failed:", e.message);
    }
  }
  throw new Error("All FX sources failed");
}

async function onCalculate(options = {}) {
  const { skipZeroWarning = false } = options;
  $("fxStatus").textContent = "";
  $("outMinPriceNote").textContent = "";
  $("psMinPriceNote").textContent = "";
  syncPrintQuoteDetails();

  const breakdown = calculateTotalsEUR(skipZeroWarning);
  if (breakdown == null) {
    clearOutputs();
    return;
  }

  const minimumApplied = breakdown.minimumPrice > 0 && breakdown.finalTotal < breakdown.minimumPrice;
  const displayedTotalEUR = minimumApplied ? breakdown.minimumPrice : breakdown.finalTotal;
  const fxRate = Number($("usdPerEur")?.value);

  animateMoneyText("outTotalEUR", "€ ", displayedTotalEUR);
  setBreakdownOutputsEUR(breakdown);
  showDonateNoteBriefly();
  if (minimumApplied) {
    $("outMinPriceNote").textContent = "Applied minimum price";
    $("psMinPriceNote").textContent = "Applied minimum price";
  }

  if (!Number.isFinite(fxRate) || fxRate <= 0) {
    setText("outTotalUSD", "—");
    setText("psTotalUSD", "—");
    setText("fxStatus", "USD disabled (invalid rate)");
    return;
  }

  const totalUSD = displayedTotalEUR * fxRate;
  const grandTotalUSD = breakdown.finalTotal * fxRate;

  animateMoneyText("outTotalUSD", "$ ", totalUSD);
  setText("psTotalUSD", `$ ${fmtMoney(totalUSD)}`);
  setText("fxStatus", `Manual rate: 1 EUR = ${fxRate.toFixed(4)} USD`);
}

function setupLiveCalculate() {
  let timer = null;

  const debouncedCalculate = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      onCalculate({ skipZeroWarning: true });
    }, 200);
  };

  document.querySelectorAll('input[type="number"]').forEach((input) => {
    input.addEventListener("input", debouncedCalculate);
  });

  $("printerType").addEventListener("change", debouncedCalculate);
}

function onExportPdf() {
  if ($("outTotalEUR").textContent.trim() === "—") {
    const proceed = confirm("You haven't calculated a total yet. Export anyway?");
    if (!proceed) return;
  }

  $("psTotalEUR").textContent = $("outTotalEUR").textContent || "—";
  $("psTotalUSD").textContent = $("outTotalUSD").textContent || "—";
  $("psMinPriceNote").textContent = $("outMinPriceNote").textContent || "";

  $("psPrinter").textContent = $("printerType").selectedOptions[0]?.textContent || "—";
  $("psFilament").textContent = $("filamentUsedGrams").value
    ? `${$("filamentUsedGrams").value} g`
    : "—";
  $("psTime").textContent = $("printTimeHours").value
    ? `${$("printTimeHours").value} h`
    : "—";

  syncPrintQuoteDetails();

  $("psTimestamp").textContent = `Generated: ${new Date().toLocaleString()}`;

  window.print();
}

function buildQuoteSummaryText() {
  const timestamp = new Date().toLocaleString();
  const totalEUR = $("outTotalEUR")?.textContent?.trim() || "—";
  const totalUSD = $("outTotalUSD")?.textContent?.trim() || "—";
  const quantity = $("outQuantity")?.textContent?.trim() || "";
  const grandTotal = $("outGrandTotal")?.textContent?.trim() || "";
  const printer = $("printerType")?.selectedOptions?.[0]?.textContent?.trim() || "";
  const filamentG = $("filamentUsedGrams")?.value?.trim() || "";
  const printTimeH = $("printTimeHours")?.value?.trim() || "";
  const profitMargin = $("profitMargin")?.value?.trim() || "";
  const usdPerEur = $("usdPerEur")?.value?.trim() || "";

  const lines = [
    "PrintMetric",
    `Timestamp: ${timestamp}`,
    `Total EUR: ${totalEUR}`,
    `Total USD: ${totalUSD}`
  ];

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
  if (profitMargin) {
    lines.push(`Profit margin: ${profitMargin}%`);
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

  if (calcBtn) calcBtn.addEventListener("click", onCalculate);
  if (exportBtn) exportBtn.addEventListener("click", onExportPdf);
  if (copyBtn) copyBtn.addEventListener("click", onCopySummary);
}

function boot() {
  populatePrinters();
  setupPrinterChange();
  setupGcodeUpload();
  setupProfiles();
  setupCalculate();
  setupLiveCalculate();
  setupPersistence();
  restorePersistedFields();
  onCalculate({ skipZeroWarning: true });
}

document.addEventListener("DOMContentLoaded", boot);
