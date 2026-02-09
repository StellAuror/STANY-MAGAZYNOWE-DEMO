import { el } from '../utils/dom.js';
import { getContractors, getActiveWarehouseId, getSelectedDate, getCurrentUser } from '../store/selectors.js';
import { openInventoryModal, setSelectedDate, addContractor } from '../store/actions.js';
import { 
  calculateTotalStock, 
  calculateDayBalance, 
  isDayCompleted, 
  markDayCompleted,
  calculateDayRevenue,
  calculateStorageRevenue,
  calculateAdditionalServicesRevenue,
  calculateAverage30DayStock
} from '../services/inventoryService.js';
import { formatBalance, formatCurrency } from '../utils/format.js';

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

  // Date control only
  const toolbar = el('div', { className: 'settings-bar' });
  toolbar.appendChild(el('label', { htmlFor: 'date-picker' }, 'Dzień roboczy:'));
  const dateInput = el('input', {
    type: 'date',
    id: 'date-picker',
    value: selectedDate,
    onChange: (e) => setSelectedDate(e.target.value),
  });
  toolbar.appendChild(dateInput);

  wrapper.appendChild(toolbar);

  // Table
  const table = el('table', { className: 'data-table' });

  // Header
  const thead = el('thead');
  const headerRow = el('tr');
  headerRow.appendChild(el('th', {}, 'Kontrahent'));
  headerRow.appendChild(el('th', { className: 'text-right' }, 'Stan całkowity'));
  headerRow.appendChild(el('th', { className: 'text-right' }, 'Średni stan 30d'));
  headerRow.appendChild(el('th', { className: 'text-right' }, 'Bilans dnia'));
  headerRow.appendChild(el('th', { className: 'text-right' }, 'Obrót wej/wyj'));
  headerRow.appendChild(el('th', { className: 'text-right' }, 'Obrót stan'));
  headerRow.appendChild(el('th', { className: 'text-right' }, 'Usługi dodat.'));
  headerRow.appendChild(el('th', { className: 'text-center' }, 'Dane wprowadzone'));
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body
  const tbody = el('tbody');

  if (contractors.length === 0) {
    const emptyRow = el('tr');
    emptyRow.appendChild(el('td', { colspan: '8', className: 'text-center text-secondary', style: { padding: '24px' } },
      'Brak kontrahentów. Kliknij "+ Kontrahent", aby dodać.'));
    tbody.appendChild(emptyRow);
  }

  for (const contractor of contractors) {
    if (!warehouseId) continue;

    const totalStock = calculateTotalStock(contractor.id, warehouseId);
    const dayBalance = calculateDayBalance(contractor.id, warehouseId, selectedDate);
    const completed = isDayCompleted(contractor.id, warehouseId, selectedDate);
    const dayRevenue = calculateDayRevenue(contractor.id, warehouseId, selectedDate);
    const storageRevenue = calculateStorageRevenue(contractor.id, warehouseId, selectedDate);
    const additionalRevenue = calculateAdditionalServicesRevenue(contractor.id, warehouseId, selectedDate);
    const avg30Days = calculateAverage30DayStock(contractor.id, warehouseId, selectedDate);

    const row = el('tr');

    // Contractor name
    row.appendChild(el('td', { className: 'font-semibold' }, contractor.name));

    // Total stock
    row.appendChild(el('td', { className: 'cell-number' }, String(totalStock)));
    
    // Average 30-day stock
    row.appendChild(el('td', { className: 'cell-number' }, avg30Days.toFixed(1)));

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

    // Status badge
    const statusCell = el('td', { className: 'text-center' });
    const badge = el('span', {
      className: completed ? 'badge badge-success' : 'badge badge-secondary',
    }, completed ? '✓' : '—');
    statusCell.appendChild(badge);
    row.appendChild(statusCell);

    tbody.appendChild(row);
  }

  table.appendChild(tbody);
  wrapper.appendChild(table);

  return wrapper;
}

