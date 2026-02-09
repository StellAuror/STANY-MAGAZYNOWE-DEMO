/** @param {Date} [d] */
export function toISODate(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** @param {string} iso e.g. "2026-02-05" */
export function parseISODate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** @param {string} iso */
export function formatDatePL(iso) {
  const d = parseISODate(iso);
  return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** @param {string} iso e.g. "2026-02" */
export function getMonthLabel(iso) {
  const [y, m] = iso.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
}

/** Returns array of "YYYY-MM-DD" for every day in given month */
export function getDaysInMonth(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  const days = [];
  const count = new Date(y, m, 0).getDate();
  for (let d = 1; d <= count; d++) {
    days.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return days;
}

/** Returns "YYYY-MM" for a given "YYYY-MM-DD" */
export function getYearMonth(isoDate) {
  return isoDate.slice(0, 7);
}

export function today() {
  return toISODate(new Date());
}

export function formatTimestamp(ts) {
  const d = new Date(ts);
  return d.toLocaleString('pl-PL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}
