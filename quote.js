(function (root, factory) {
  const quote = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = quote;
  }

  root.QUOTE = quote;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function isIsoDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year
      && date.getUTCMonth() === month - 1
      && date.getUTCDate() === day;
  }

  function validateDateRange(quoteDate, validUntil) {
    if (!quoteDate || !validUntil) return { valid: true, message: "" };
    if (!isIsoDate(quoteDate) || !isIsoDate(validUntil)) {
      return { valid: false, message: "Enter valid quote dates." };
    }
    if (validUntil < quoteDate) {
      return { valid: false, message: "Valid until cannot be earlier than the quote date." };
    }
    return { valid: true, message: "" };
  }

  return { isIsoDate, validateDateRange };
});
