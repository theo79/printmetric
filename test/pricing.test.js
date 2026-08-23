const test = require("node:test");
const assert = require("node:assert/strict");

const { calculatePricing, convertEurToUsd, validatePricingInput } = require("../pricing.js");

function closeTo(actual, expected, tolerance = 1e-12) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

test("requires positive filament weight but allows a zero filament price", () => {
  assert.equal(calculatePricing({ filamentG: 0, filamentCostPerKg: 20 }), null);
  assert.equal(calculatePricing({ filamentG: 100, filamentCostPerKg: 0 }).filamentCost, 0);
});

test("calculates the current quantity-one pricing flow", () => {
  const result = calculatePricing({
    filamentG: 100,
    filamentCostPerKg: 20,
    hours: 2,
    avgPowerW: 100,
    kwhRate: 0.3,
    wear: 1,
    laborMins: 30,
    laborPerHour: 10,
    marginPct: 20,
    failureWastePct: 0,
    quantity: 1,
    minimumPrice: 0
  });

  closeTo(result.filamentCost, 2);
  closeTo(result.energyKwh, 0.2);
  closeTo(result.electricityCost, 0.06);
  closeTo(result.laborCost, 5);
  closeTo(result.wearCost, 1);
  closeTo(result.subtotal, 8.06);
  closeTo(result.markupAmount, 1.612);
  closeTo(result.finalTotalSingle, 9.672);
  closeTo(result.finalTotal, 9.672);
  assert.equal(result.quantity, 1);
  assert.equal(result.minimumApplied, false);
});

test("multiplies the complete per-print total by quantity", () => {
  const result = calculatePricing({
    filamentG: 100,
    filamentCostPerKg: 20,
    wear: 1,
    laborMins: 30,
    laborPerHour: 10,
    marginPct: 20,
    quantity: 3
  });

  closeTo(result.finalTotalSingle, 9.6);
  closeTo(result.finalTotal, 28.8);
  assert.equal(result.quantity, 3);
});

test("keeps filament, electricity, and machine wear as per-unit costs", () => {
  const result = calculatePricing({
    filamentG: 100,
    filamentCostPerKg: 20,
    hours: 2,
    avgPowerW: 100,
    kwhRate: 0.3,
    wear: 1,
    quantity: 2
  });

  closeTo(result.filamentCost, 2);
  closeTo(result.filamentCostTotal, 4);
  closeTo(result.electricityCost, 0.06);
  closeTo(result.electricityCostTotal, 0.12);
  closeTo(result.wearCost, 1);
  closeTo(result.wearCostTotal, 2);
});

test("charges setup labor once and labor per unit for quantities 1, 2, and 10", () => {
  const expected = new Map([
    [1, { perUnitTotal: 10 / 3, total: 40 / 3 }],
    [2, { perUnitTotal: 20 / 3, total: 50 / 3 }],
    [10, { perUnitTotal: 100 / 3, total: 130 / 3 }]
  ]);

  for (const [quantity, costs] of expected) {
    const result = calculatePricing({
      filamentG: 1,
      filamentCostPerKg: 1,
      setupLaborMins: 30,
      laborMinsPerUnit: 10,
      laborPerHour: 20,
      quantity
    });

    closeTo(result.setupLaborCost, 10);
    closeTo(result.laborCostPerUnit, 10 / 3);
    closeTo(result.perUnitLaborTotal, costs.perUnitTotal);
    closeTo(result.laborCost, costs.total);
  }
});

test("matches the requested setup and per-unit labor example", () => {
  const result = calculatePricing({
    filamentG: 1,
    filamentCostPerKg: 1,
    setupLaborMins: 30,
    laborMinsPerUnit: 10,
    laborPerHour: 20,
    quantity: 3
  });

  closeTo(result.setupLaborCost, 10);
  closeTo(result.perUnitLaborTotal, 10);
  closeTo(result.laborCost, 20);
});

test("treats the legacy hands-on labor value as labor per unit", () => {
  const savedProfile = { handsOnLaborMins: "10" };
  const result = calculatePricing({
    filamentG: 1,
    filamentCostPerKg: 1,
    laborMins: savedProfile.handsOnLaborMins,
    laborPerHour: 20,
    quantity: 2
  });

  closeTo(result.setupLaborCost, 0);
  closeTo(result.laborCostPerUnit, 10 / 3);
  closeTo(result.perUnitLaborTotal, 20 / 3);
});

test("rejects invalid quantity instead of silently normalizing it", () => {
  assert.equal(calculatePricing({ filamentG: 1, filamentCostPerKg: 1, quantity: 2.9 }), null);
  assert.equal(calculatePricing({ filamentG: 1, filamentCostPerKg: 1, quantity: 0 }), null);
  assert.equal(calculatePricing({ filamentG: 1, filamentCostPerKg: 1, quantity: -4 }), null);
});

test("adds failure/waste to the subtotal before markup", () => {
  const result = calculatePricing({
    filamentG: 100,
    filamentCostPerKg: 20,
    failureWastePct: 10,
    marginPct: 20,
    quantity: 1
  });

  closeTo(result.subtotal, 2);
  closeTo(result.failureAllowanceAmount, 0.2);
  closeTo(result.adjustedCost, 2.2);
  closeTo(result.markupAmount, 0.44);
  closeTo(result.finalTotal, 2.64);
});

test("0% waste allowance adds nothing", () => {
  const result = calculatePricing({
    filamentG: 1000,
    filamentCostPerKg: 100,
    wasteAllowancePct: 0
  });

  closeTo(result.subtotal, 100);
  closeTo(result.wasteAllowanceAmount, 0);
  closeTo(result.adjustedCost, 100);
});

test("5% waste allowance adds exactly 5%", () => {
  const result = calculatePricing({
    filamentG: 1000,
    filamentCostPerKg: 100,
    wasteAllowancePct: 5
  });

  closeTo(result.wasteAllowanceAmount, 5);
  closeTo(result.adjustedCost, 105);
});

test("10% waste allowance adds exactly 10%", () => {
  const result = calculatePricing({
    filamentG: 1000,
    filamentCostPerKg: 100,
    wasteAllowancePct: 10
  });

  closeTo(result.wasteAllowanceAmount, 10);
  closeTo(result.adjustedCost, 110);
});

test("rejects negative waste allowance and does not impose an arbitrary maximum", () => {
  const negative = calculatePricing({
    filamentG: 1000,
    filamentCostPerKg: 100,
    wasteAllowancePct: -25
  });
  const excessive = calculatePricing({
    filamentG: 1000,
    filamentCostPerKg: 100,
    wasteAllowancePct: 500
  });

  assert.equal(negative, null);
  assert.equal(excessive.wasteAllowancePct, 500);
  closeTo(excessive.wasteAllowanceAmount, 500);
  closeTo(excessive.adjustedCost, 600);
});

test("continues to use values restored from the legacy failureWasteAllowance profile key", () => {
  const savedProfile = { failureWasteAllowance: "5" };
  const result = calculatePricing({
    filamentG: 1000,
    filamentCostPerKg: 100,
    wasteAllowancePct: savedProfile.failureWasteAllowance
  });

  closeTo(result.wasteAllowanceAmount, 5);
  closeTo(result.adjustedCost, 105);
});

test("leaves an order total above the minimum order price unchanged", () => {
  const result = calculatePricing({
    filamentG: 1000,
    filamentCostPerKg: 100,
    quantity: 1,
    minimumOrderPrice: 50
  });

  closeTo(result.finalTotal, 100);
  assert.equal(result.minimumOrderPriceApplied, false);
  closeTo(result.displayedTotalEUR, 100);
});

test("raises an order total below the minimum order price", () => {
  const result = calculatePricing({
    filamentG: 1000,
    filamentCostPerKg: 30,
    quantity: 1,
    minimumOrderPrice: 50
  });

  closeTo(result.finalTotal, 30);
  assert.equal(result.minimumOrderPriceApplied, true);
  closeTo(result.displayedTotalEUR, 50);
});

test("applies the minimum order price after quantity greater than one", () => {
  const result = calculatePricing({
    filamentG: 100,
    filamentCostPerKg: 30,
    quantity: 10,
    minimumOrderPrice: 50
  });

  closeTo(result.finalTotalSingle, 3);
  closeTo(result.finalTotal, 30);
  closeTo(result.displayedTotalEUR, 50);
  closeTo(result.displayedTotalEUR / result.quantity, 5);
});

test("does not apply a zero minimum order price", () => {
  const result = calculatePricing({
    filamentG: 100,
    filamentCostPerKg: 30,
    quantity: 10,
    minimumOrderPrice: 0
  });

  closeTo(result.finalTotal, 30);
  assert.equal(result.minimumOrderPriceApplied, false);
  closeTo(result.displayedTotalEUR, 30);
});

test("supports decimal minimum order prices", () => {
  const result = calculatePricing({
    filamentG: 1000,
    filamentCostPerKg: 30,
    quantity: 1,
    minimumOrderPrice: 50.75
  });

  assert.equal(result.minimumOrderPriceApplied, true);
  closeTo(result.displayedTotalEUR, 50.75);
});

test("continues to accept the legacy minimumPrice profile/API key", () => {
  const savedProfile = { minimumPrice: "50" };
  const result = calculatePricing({
    filamentG: 1000,
    filamentCostPerKg: 30,
    minimumPrice: savedProfile.minimumPrice
  });

  assert.equal(result.minimumOrderPrice, 50);
  assert.equal(result.minimumPrice, 50);
  assert.equal(result.minimumOrderPriceApplied, true);
  closeTo(result.displayedTotalEUR, 50);
});

test("€100 cost plus 20% markup produces €20 markup and €120 selling price", () => {
  const result = calculatePricing({
    filamentG: 1000,
    filamentCostPerKg: 100,
    markupPct: 20,
    quantity: 1
  });

  closeTo(result.adjustedCost, 100);
  closeTo(result.markupAmount, 20);
  closeTo(result.finalTotalSingle, 120);
});

test("continues to accept the legacy marginPct value used by existing integrations", () => {
  const result = calculatePricing({
    filamentG: 1000,
    filamentCostPerKg: 100,
    marginPct: 20
  });

  closeTo(result.markupAmount, 20);
  closeTo(result.finalTotalSingle, 120);
});

test("continues to use markup values restored from the legacy profitMargin profile key", () => {
  const savedProfile = { profitMargin: "20" };
  const result = calculatePricing({
    filamentG: 1000,
    filamentCostPerKg: 100,
    markupPct: savedProfile.profitMargin
  });

  closeTo(result.markupAmount, 20);
  closeTo(result.finalTotalSingle, 120);
});

test("preserves decimal inputs without premature rounding", () => {
  const result = calculatePricing({
    filamentG: 123.45,
    filamentCostPerKg: 22.75,
    hours: 3.75,
    avgPowerW: 137.5,
    kwhRate: 0.183,
    wear: 1.25,
    laborMins: 17.5,
    laborPerHour: 12.4,
    marginPct: 17.5,
    failureWastePct: 4.5,
    quantity: 2
  });

  closeTo(result.filamentCost, 2.8084875);
  closeTo(result.energyKwh, 0.515625);
  closeTo(result.electricityCost, 0.094359375);
  closeTo(result.laborCostPerUnit, 3.6166666666666667);
  closeTo(result.laborCost, 7.233333333333334);
  closeTo(result.orderSubtotal, 15.539027083333334);
  closeTo(result.finalTotal, 19.07998287994792);
  assert.equal(result.quantity, 2);
});

test("treats missing optional numeric values as zero", () => {
  const result = calculatePricing({
    filamentG: "100",
    filamentCostPerKg: "20",
    hours: undefined,
    avgPowerW: undefined,
    kwhRate: null,
    wear: "",
    laborMins: undefined,
    laborPerHour: undefined,
    marginPct: undefined,
    failureWastePct: undefined,
    quantity: undefined,
    minimumPrice: undefined
  });

  closeTo(result.finalTotal, 2);
  assert.equal(result.quantity, 1);
  assert.equal(result.minimumPrice, 0);
  assert.equal(result.minimumApplied, false);
});

test("treats invalid required numeric values as missing", () => {
  assert.equal(calculatePricing({ filamentG: "invalid", filamentCostPerKg: 20 }), null);
  assert.equal(calculatePricing({ filamentG: 100, filamentCostPerKg: NaN }), null);
});

test("rejects malformed and negative optional values instead of treating them as zero", () => {
  assert.equal(calculatePricing({ filamentG: 100, filamentCostPerKg: 20, hours: "invalid" }), null);
  assert.equal(calculatePricing({ filamentG: 100, filamentCostPerKg: 20, wear: -0.01 }), null);
  assert.equal(calculatePricing({ filamentG: 100, filamentCostPerKg: 20, markupPct: -1 }), null);
});

test("validates every numeric form field with field-specific errors", () => {
  const result = validatePricingInput({
    filamentG: -1,
    filamentCostPerKg: -1,
    hours: -1,
    avgPowerW: -1,
    kwhRate: -1,
    wear: -1,
    setupLaborMins: -1,
    laborMinsPerUnit: -1,
    laborPerHour: -1,
    markupPct: -1,
    wasteAllowancePct: -1,
    quantity: 1.5,
    minimumOrderPrice: -1,
    filamentDiameter: 0,
    materialDensity: 0,
    usdPerEur: 0
  }, { validatePhysicalInputs: true, usdEnabled: true, requireQuantity: true });

  assert.equal(result.valid, false);
  assert.deepEqual(Object.keys(result.errors).sort(), [
    "avgPowerW", "filamentCostPerKg", "filamentDiameter", "filamentG", "hours",
    "kwhRate", "laborMinsPerUnit", "laborPerHour", "markupPct", "materialDensity",
    "minimumOrderPrice", "quantity", "setupLaborMins", "usdPerEur", "wasteAllowancePct", "wear"
  ]);
});

test("accepts zero, 0.01 and 12.5 wherever those values are valid", () => {
  const result = validatePricingInput({
    filamentG: 12.5,
    filamentCostPerKg: 0,
    hours: 0,
    avgPowerW: 0.01,
    kwhRate: 0,
    wear: 0,
    setupLaborMins: 12.5,
    laborMinsPerUnit: 0.01,
    laborPerHour: 0,
    markupPct: 0,
    wasteAllowancePct: 0,
    quantity: 1,
    minimumOrderPrice: 0,
    filamentDiameter: 0.01,
    materialDensity: 0.01,
    usdPerEur: 0.01
  }, { validatePhysicalInputs: true, usdEnabled: true, requireQuantity: true });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, {});
});

test("converts EUR to USD using the current multiplication behavior", () => {
  closeTo(convertEurToUsd(12.5, 1.1), 13.75);
  assert.equal(convertEurToUsd(12.5, 0), null);
  assert.equal(convertEurToUsd(12.5, "invalid"), null);
});

test("matches the legacy app.js formula for representative inputs", () => {
  function legacyCalculation(input) {
    const numberOrZero = (value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const filamentG = numberOrZero(input.filamentG);
    const filamentCostPerKg = numberOrZero(input.filamentCostPerKg);
    const hours = numberOrZero(input.hours);
    const avgPowerW = numberOrZero(input.avgPowerW);
    const kwhRate = numberOrZero(input.kwhRate);
    const wear = numberOrZero(input.wear);
    const laborMins = numberOrZero(input.laborMins);
    const laborPerHour = numberOrZero(input.laborPerHour);
    const marginPct = numberOrZero(input.marginPct);
    const failureWastePct = numberOrZero(input.failureWastePct);
    const quantity = Math.max(1, numberOrZero(input.quantity));
    const minimumPrice = Math.max(0, numberOrZero(input.minimumPrice));

    if (filamentG <= 0 || filamentCostPerKg <= 0) return null;

    const filamentCost = (filamentG / 1000) * filamentCostPerKg;
    const energyKwh = avgPowerW > 0 && hours > 0 ? (avgPowerW / 1000) * hours : 0;
    const electricityCost = avgPowerW > 0 && kwhRate > 0 && hours > 0
      ? ((avgPowerW * hours) / 1000) * kwhRate
      : 0;
    const laborCost = laborPerHour * (laborMins / 60);
    const wearCost = wear;
    const subtotal = filamentCost + electricityCost + laborCost + wearCost;
    const failureAllowanceAmount = subtotal * (failureWastePct / 100);
    const adjustedCost = subtotal + failureAllowanceAmount;
    const markupAmount = adjustedCost * (marginPct / 100);
    const finalTotalSingle = adjustedCost + markupAmount;
    const finalTotal = finalTotalSingle * quantity;

    return {
      filamentCost,
      energyKwh,
      electricityCost,
      laborCost,
      wearCost,
      subtotal,
      wasteAllowancePct: failureWastePct,
      wasteAllowanceAmount: failureAllowanceAmount,
      failureWastePct,
      failureAllowanceAmount,
      adjustedCost,
      markupAmount,
      profitAmount: markupAmount,
      quantity,
      minimumOrderPrice: minimumPrice,
      minimumPrice,
      finalTotalSingle,
      finalTotal,
      minimumOrderPriceApplied: minimumPrice > 0 && finalTotal < minimumPrice,
      minimumApplied: minimumPrice > 0 && finalTotal < minimumPrice,
      displayedTotalEUR: minimumPrice > 0 && finalTotal < minimumPrice ? minimumPrice : finalTotal
    };
  }

  const cases = [
    { filamentG: 100, filamentCostPerKg: 20, quantity: 1 },
    { filamentG: 240, filamentCostPerKg: 18.5, hours: 8, avgPowerW: 220, kwhRate: 0.21, quantity: 4 },
    { filamentG: 15.75, filamentCostPerKg: 31.2, wear: 2.25, laborMins: 45, laborPerHour: 14, marginPct: 35, failureWastePct: 12, minimumPrice: 30 },
    { filamentG: "invalid", filamentCostPerKg: 20, quantity: undefined }
  ];

  for (const input of cases) {
    const current = calculatePricing(input);
    const legacy = legacyCalculation(input);
    if (legacy == null) {
      assert.equal(current, null);
      continue;
    }
    closeTo(current.finalTotal, legacy.finalTotal);
    closeTo(current.finalTotalSingle, legacy.finalTotalSingle);
    closeTo(current.displayedTotalEUR, legacy.displayedTotalEUR);
  }
});
