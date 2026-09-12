(function (root, factory) {
  const pricing = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = pricing;
  }

  root.PRICING = pricing;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function isBlank(value) {
    return value == null || (typeof value === "string" && value.trim() === "");
  }

  function validatePricingInput(input = {}, options = {}) {
    const errors = {};

    function check(name, value, rule = {}) {
      if (isBlank(value)) {
        if (rule.required) errors[name] = rule.requiredMessage || "This value is required.";
        return;
      }

      const number = Number(value);
      if (!Number.isFinite(number)) {
        errors[name] = "Enter a valid number.";
      } else if (rule.integer && !Number.isInteger(number)) {
        errors[name] = "Enter a whole number.";
      } else if (rule.greaterThan != null && number <= rule.greaterThan) {
        errors[name] = rule.positiveMessage || `Enter a value greater than ${rule.greaterThan}.`;
      } else if (rule.min != null && number < rule.min) {
        errors[name] = rule.min === 0 ? "Value cannot be negative." : `Enter ${rule.min} or more.`;
      }
    }

    check("filamentG", input.filamentG, {
      required: true,
      greaterThan: 0,
      requiredMessage: "Enter the filament weight.",
      positiveMessage: "Filament weight must be greater than zero."
    });
    check("filamentCostPerKg", input.filamentCostPerKg, {
      required: true,
      min: 0,
      requiredMessage: "Enter the filament price."
    });
    check("hours", input.hours, { min: 0 });
    check("avgPowerW", input.avgPowerW, { min: 0 });
    check("kwhRate", input.kwhRate, { min: 0 });
    check("wear", input.wear, { min: 0 });
    check("setupLaborMins", input.setupLaborMins, { min: 0 });
    check("laborMinsPerUnit", input.laborMinsPerUnit ?? input.laborMins, { min: 0 });
    check("laborPerHour", input.laborPerHour, { min: 0 });
    check("markupPct", input.markupPct ?? input.marginPct, { min: 0 });
    check("wasteAllowancePct", input.wasteAllowancePct ?? input.failureWastePct, { min: 0 });
    check("quantity", input.quantity, {
      required: Boolean(options.requireQuantity),
      integer: true,
      greaterThan: 0,
      requiredMessage: "Enter the quantity.",
      positiveMessage: "Quantity must be at least 1."
    });
    check("minimumOrderPrice", input.minimumOrderPrice ?? input.minimumPrice, { min: 0 });

    if (options.validatePhysicalInputs || !isBlank(input.filamentDiameter)) {
      check("filamentDiameter", input.filamentDiameter, {
        required: true,
        greaterThan: 0,
        positiveMessage: "Filament diameter must be greater than zero."
      });
    }
    if (options.validatePhysicalInputs || !isBlank(input.materialDensity)) {
      check("materialDensity", input.materialDensity, {
        required: true,
        greaterThan: 0,
        positiveMessage: "Material density must be greater than zero."
      });
    }
    if (options.usdEnabled || !isBlank(input.usdPerEur)) {
      check("usdPerEur", input.usdPerEur, {
        required: true,
        greaterThan: 0,
        requiredMessage: "Enter an exchange rate to show USD.",
        positiveMessage: "Exchange rate must be greater than zero."
      });
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }

  function calculatePricing(input = {}) {
    const validation = validatePricingInput(input);
    if (!validation.valid) return null;

    const filamentG = toNumber(input.filamentG);
    const filamentCostPerKg = toNumber(input.filamentCostPerKg);
    const hours = toNumber(input.hours);
    const avgPowerW = toNumber(input.avgPowerW);
    const kwhRate = toNumber(input.kwhRate);
    const wear = toNumber(input.wear);
    const setupLaborMins = toNumber(input.setupLaborMins);
    // `laborMins` remains accepted as the legacy per-unit labor value.
    const laborMinsPerUnit = toNumber(input.laborMinsPerUnit ?? input.laborMins);
    const laborPerHour = toNumber(input.laborPerHour);
    // `marginPct` remains accepted for compatibility with the original app API.
    const markupPct = toNumber(input.markupPct ?? input.marginPct);
    // `failureWastePct` remains accepted for saved-profile/API compatibility.
    const wasteAllowancePct = toNumber(
      input.wasteAllowancePct ?? input.failureWastePct
    );
    const quantity = isBlank(input.quantity) ? 1 : toNumber(input.quantity);
    // `minimumPrice` remains accepted for saved-profile/API compatibility.
    const minimumOrderPrice = toNumber(
      input.minimumOrderPrice ?? input.minimumPrice
    );

    const filamentCost = (filamentG / 1000) * filamentCostPerKg;
    const energyKwh = (avgPowerW > 0 && hours > 0)
      ? (avgPowerW / 1000) * hours
      : 0;
    const electricityCost = (avgPowerW > 0 && kwhRate > 0 && hours > 0)
      ? ((avgPowerW * hours) / 1000) * kwhRate
      : 0;
    const setupLaborCost = laborPerHour * (setupLaborMins / 60);
    const laborCostPerUnit = laborPerHour * (laborMinsPerUnit / 60);
    const perUnitLaborTotal = laborCostPerUnit * quantity;
    const laborCost = setupLaborCost + perUnitLaborTotal;
    const wearCost = wear;
    const filamentCostTotal = filamentCost * quantity;
    const energyKwhTotal = energyKwh * quantity;
    const electricityCostTotal = electricityCost * quantity;
    const wearCostTotal = wearCost * quantity;
    const perUnitSubtotal = filamentCost + electricityCost + laborCostPerUnit + wearCost;
    const orderSubtotal = (perUnitSubtotal * quantity) + setupLaborCost;
    const wasteAllowanceAmount = orderSubtotal * (wasteAllowancePct / 100);
    const adjustedCost = orderSubtotal + wasteAllowanceAmount;
    const markupAmount = adjustedCost * (markupPct / 100);
    const finalTotal = adjustedCost + markupAmount;
    const finalTotalSingle = finalTotal / quantity;
    const minimumOrderPriceApplied = minimumOrderPrice > 0 && finalTotal < minimumOrderPrice;
    const displayedTotalEUR = minimumOrderPriceApplied ? minimumOrderPrice : finalTotal;
    const effectiveUnitPrice = displayedTotalEUR / quantity;

    return {
      filamentCost,
      filamentCostTotal,
      energyKwh,
      energyKwhTotal,
      electricityCost,
      electricityCostTotal,
      setupLaborCost,
      laborCostPerUnit,
      perUnitLaborTotal,
      laborCost,
      wearCost,
      wearCostTotal,
      perUnitSubtotal,
      orderSubtotal,
      // Legacy result name now represents the complete order subtotal.
      subtotal: orderSubtotal,
      wasteAllowancePct,
      wasteAllowanceAmount,
      // Legacy result names retained for callers of the baseline module.
      failureWastePct: wasteAllowancePct,
      failureAllowanceAmount: wasteAllowanceAmount,
      adjustedCost,
      markupAmount,
      // Legacy result name retained for callers of the baseline pricing module.
      profitAmount: markupAmount,
      quantity,
      minimumOrderPrice,
      // Legacy result name retained for callers of the baseline module.
      minimumPrice: minimumOrderPrice,
      finalTotalSingle,
      effectiveUnitPrice,
      finalTotal,
      minimumOrderPriceApplied,
      // Legacy result name retained for callers of the baseline module.
      minimumApplied: minimumOrderPriceApplied,
      displayedTotalEUR
    };
  }

  function convertEurToUsd(amountEUR, usdPerEur) {
    const amount = Number(amountEUR);
    const rate = Number(usdPerEur);

    if (!Number.isFinite(amount) || !Number.isFinite(rate) || rate <= 0) {
      return null;
    }

    return amount * rate;
  }

  return {
    calculatePricing,
    convertEurToUsd,
    validatePricingInput
  };
});
