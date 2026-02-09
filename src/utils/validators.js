/** Validate quantity: integer >= 0 */
export function isValidQty(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0;
}

/** Parse and clamp qty to integer >= 0, returns null if invalid */
export function parseQty(value) {
  const n = parseInt(value, 10);
  if (isNaN(n) || n < 0) return null;
  return n;
}

/** Validate price: number >= 0, up to 2 decimals */
export function isValidPrice(value) {
  const n = Number(value);
  if (isNaN(n) || n < 0) return false;
  const parts = String(value).split('.');
  if (parts.length > 1 && parts[1].length > 2) return false;
  return true;
}

/** Parse price, returns null if invalid */
export function parsePrice(value) {
  const n = parseFloat(value);
  if (isNaN(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

/** Validate ISO date string */
export function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
}

/** Validate non-empty string */
export function isNonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}
