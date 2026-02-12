import { el } from '../utils/dom.js';
import { getContractors, getActiveWarehouseId, getSelectedDate, getCurrentUser } from '../store/selectors.js';
import { openInventoryModal, addContractor } from '../store/actions.js';
import {
  calculateTotalStock,
  calculateDayBalance,
  isDayCompleted,
  markDayCompleted,
  calculateDayRevenue,
  calculateStorageRevenue,
  calculateAdditionalServicesRevenue,
  calculateAverage30DayStock,
  calculateStockTrend,
  getFirstEntryInfo
} from '../services/inventoryService.js';
import { formatBalance, formatCurrency } from '../utils/format.js';
import { today, parseISODate } from '../utils/date.js';

/**
 * Main contractors table for the inventory view.
 * Shows: Contractor name, Total stock, Day balance, Status (with manual checkbox).
 */
export function ContractorsTable() {
  const contractors = getContractors();
  const warehouseId = getActiveWarehouseId();
  const selectedDate = getSelectedDate();
  const userName = getCurrentUser();

  const wrapper = el('div');

  // Table
  const table = el('table', { className: 'data-table' });

  // Header
  const thead = el('thead');
  const headerRow = el('tr');
  headerRow.appendChild(el('th', {}, 'Kontrahent'));
  headerRow.appendChild(el('th', { className: 'text-right' }, 'Stan ca\u0142kowity'));
  headerRow.appendChild(el('th', { className: 'text-right' }, '\u015Aredni stan 30d'));
  headerRow.appendChild(el('th', { className: 'text-right' }, 'Bilans dnia'));
  headerRow.appendChild(el('th', { className: 'text-right' }, 'Obr\u00F3t wej/wyj'));
  headerRow.appendChild(el('th', { className: 'text-right' }, 'Obr\u00F3t stan'));
  headerRow.appendChild(el('th', { className: 'text-right' }, 'Us\u0142ugi dodat.'));
  headerRow.appendChild(el('th', { className: 'text-center' }, 'Dane wprowadzone'));
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body
  const tbody = el('tbody');

  if (contractors.length === 0) {
    const emptyRow = el('tr');
    emptyRow.appendChild(el('td', { colspan: '8', className: 'text-center text-secondary', style: { padding: '24px' } },
      'Brak kontrahent\u00F3w. Kliknij "+ Kontrahent", aby doda\u0107.'));
    tbody.appendChild(emptyRow);
  }

  for (const contractor of contractors) {
    if (!warehouseId) continue;

    const totalStock = calculateTotalStock(contractor.id, warehouseId, selectedDate);
    const dayBalance = calculateDayBalance(contractor.id, warehouseId, selectedDate);
    const completed = isDayCompleted(contractor.id, warehouseId, selectedDate);
    const dayRevenue = calculateDayRevenue(contractor.id, warehouseId, selectedDate);
    const storageRevenue = calculateStorageRevenue(contractor.id, warehouseId, selectedDate);
    const additionalRevenue = calculateAdditionalServicesRevenue(contractor.id, warehouseId, selectedDate);
    const avg30Days = calculateAverage30DayStock(contractor.id, warehouseId, selectedDate);
    const trend = calculateStockTrend(contractor.id, warehouseId, selectedDate);
    const entryInfo = getFirstEntryInfo(contractor.id, warehouseId, selectedDate);

    const row = el('tr');

    // Contractor name
    row.appendChild(el('td', { className: 'font-semibold' }, contractor.name));

    // Total stock
    row.appendChild(el('td', { className: 'cell-number' }, String(totalStock)));

    // Average 30-day stock + trend arrow
    const avgCell = el('td', { className: 'cell-number' });
    avgCell.appendChild(document.createTextNode(avg30Days.toFixed(1) + ' '));

    const trendArrow = trend.direction === 'up' ? '\u2191' : trend.direction === 'down' ? '\u2193' : '\u2192';
    const trendColor = trend.direction === 'up' ? 'var(--color-success)' : trend.direction === 'down' ? 'var(--color-danger)' : 'var(--color-text-secondary)';
    const trendTitle = trend.direction === 'stable'
      ? 'Stabilny trend'
      : `${trend.percentChange > 0 ? '+' : ''}${trend.percentChange}% vs poprzednie 15 dni`;

    avgCell.appendChild(el('span', {
      className: 'trend-arrow',
      style: { color: trendColor, fontWeight: '700', fontSize: '0.95rem' },
      title: trendTitle,
    }, trendArrow));
    row.appendChild(avgCell);

    // Day balance (clickable) - with bold styling
    const balanceClass = dayBalance > 0 ? 'balance-positive' : dayBalance < 0 ? 'balance-negative' : 'balance-zero';
    const balanceCell = el('td', {
      className: `cell-number cell-clickable cell-balance-bold ${balanceClass}`,
      onClick: () => openInventoryModal(contractor.id, warehouseId, selectedDate),
    }, formatBalance(dayBalance));
    row.appendChild(balanceCell);

    // Revenue - day operations (in/out)
    row.appendChild(el('td', { className: 'cell-number cell-revenue' }, formatCurrency(dayRevenue)));

    // Revenue - storage
    row.appendChild(el('td', { className: 'cell-number cell-revenue' }, formatCurrency(storageRevenue)));

    // Revenue - additional services
    row.appendChild(el('td', { className: 'cell-number cell-revenue' }, formatCurrency(additionalRevenue)));

    // Status badge with entry time / deadline info
    const statusCell = el('td', { className: 'text-center' });

    if (!entryInfo) {
      // No data entered
      statusCell.appendChild(el('span', {
        className: 'badge badge-secondary',
      }, '\u2014'));
    } else if (entryInfo.onTime) {
      // On time - show checkmark and time
      const timeStr = entryInfo.createdAt
        ? new Date(entryInfo.createdAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
        : '';
      statusCell.appendChild(el('span', {
        className: 'badge badge-success badge-time',
        title: entryInfo.createdAt
          ? `Wprowadzono: ${new Date(entryInfo.createdAt).toLocaleString('pl-PL')}`
          : 'Dane wprowadzone',
      }, `\u2713 ${timeStr}`));
    } else {
      // Past deadline
      statusCell.appendChild(el('span', {
        className: 'badge badge-warning badge-time',
        title: `Wprowadzono: ${new Date(entryInfo.createdAt).toLocaleString('pl-PL')}\nDeadline przekroczony o ${entryInfo.hoursOver}h`,
      }, `\u26A0 +${entryInfo.hoursOver}h`));
    }

    row.appendChild(statusCell);

    tbody.appendChild(row);
  }

  table.appendChild(tbody);
  wrapper.appendChild(table);

  return wrapper;
}
