/** Format number with fixed decimals, using Polish locale */
export function formatNumber(n, decimals = 0) {
  return Number(n).toLocaleString('pl-PL', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/** Format currency */
export function formatCurrency(n, currency = 'PLN') {
  return Number(n).toLocaleString('pl-PL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/** Format balance with sign: (+5), (-3), (0) */
export function formatBalance(n) {
  if (n > 0) return `(+${n})`;
  if (n < 0) return `(${n})`;
  return '(0)';
}

/** Unit labels in Polish */
const UNIT_LABELS = {
  HOUR: 'godz.',
  PIECE: 'szt.',
  KM: 'km',
  PALLET: 'paleta',
};

export function formatUnit(unit) {
  return UNIT_LABELS[unit] || unit;
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
