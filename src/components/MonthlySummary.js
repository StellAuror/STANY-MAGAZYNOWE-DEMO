import { el, clearElement } from '../utils/dom.js';
import {
  getContractors, getWarehouses, getSummaryFilters,
} from '../store/selectors.js';
import { setSelectedMonth, setSummaryContractors, setSummaryWarehouse } from '../store/actions.js';
import { getState } from '../store/store.js';
import { getMonthlySummary, getDailyChartData } from '../services/summaryService.js';
import { formatCurrency, formatUnit } from '../utils/format.js';
import { getMonthLabel } from '../utils/date.js';
import { LineChartCanvas } from './LineChartCanvas.js';

/**
 * View 3: Monthly summary with filters, table, and chart.
 */
export function MonthlySummary() {
  const contractors = getContractors();
  const warehouses = getWarehouses();
  const filters = getSummaryFilters();

  const wrapper = el('div');

  // Filters bar
  const filtersBar = el('div', { className: 'settings-bar' });

  // Month picker
  filtersBar.appendChild(el('label', {}, 'Miesiąc:'));
  const monthInput = el('input', {
    type: 'month',
    value: filters.month,
    onChange: (e) => setSelectedMonth(e.target.value),
  });
  filtersBar.appendChild(monthInput);

  // Warehouse filter
  filtersBar.appendChild(el('label', {}, 'Magazyn:'));
  const whSelect = el('select', {
    onChange: (e) => setSummaryWarehouse(e.target.value),
  });
  const allOpt = el('option', { value: 'all' }, 'Wszystkie');
  if (filters.warehouseId === 'all') allOpt.selected = true;
  whSelect.appendChild(allOpt);
  for (const wh of warehouses) {
    const opt = el('option', { value: wh.id }, wh.name);
    if (wh.id === filters.warehouseId) opt.selected = true;
    whSelect.appendChild(opt);
  }
  filtersBar.appendChild(whSelect);

  wrapper.appendChild(filtersBar);

  // Contractor multi-select
  const contractorFilter = el('div', { className: 'settings-bar' });
  contractorFilter.appendChild(el('label', {}, 'Kontrahenci:'));

  const checkboxesContainer = el('div', { className: 'flex gap-sm', style: { flexWrap: 'wrap' } });

  // Select all button
  const selectAllBtn = el('button', {
    className: 'btn-secondary btn-small',
    onClick: () => {
      setSummaryContractors(contractors.map(c => c.id));
    },
  }, 'Zaznacz wszystkich');
  checkboxesContainer.appendChild(selectAllBtn);

  const clearBtn = el('button', {
    className: 'btn-secondary btn-small',
    onClick: () => setSummaryContractors([]),
  }, 'Wyczyść');
  checkboxesContainer.appendChild(clearBtn);

  for (const c of contractors) {
    const isChecked = filters.contractorIds.includes(c.id);
    const label = el('label', { className: 'checkbox-wrap' });
    const cb = el('input', {
      type: 'checkbox',
      onChange: (e) => {
        const current = getState().selectedSummaryContractors;
        if (e.target.checked) {
          setSummaryContractors([...current, c.id]);
        } else {
          setSummaryContractors(current.filter(id => id !== c.id));
        }
      },
    });
    cb.checked = isChecked;
    label.appendChild(cb);
    label.appendChild(el('span', {}, c.name));
    checkboxesContainer.appendChild(label);
  }

  contractorFilter.appendChild(checkboxesContainer);
  wrapper.appendChild(contractorFilter);

  // Results
  if (filters.contractorIds.length === 0) {
    wrapper.appendChild(el('p', { className: 'text-secondary text-center mt-lg' },
      'Wybierz co najmniej jednego kontrahenta, aby wyświetlić podsumowanie.'));
    return wrapper;
  }

  // Get summary data
  const summaryData = getMonthlySummary(filters.month, filters.contractorIds, filters.warehouseId);

  // Summary table
  const tableSection = el('div', { className: 'mt-md' });
  const table = el('table', { className: 'summary-table' });

  const thead = el('thead');
  const headerRow = el('tr');
  headerRow.appendChild(el('th', {}, 'Kontrahent'));
  headerRow.appendChild(el('th', {}, 'Usługa'));
  headerRow.appendChild(el('th', { className: 'text-right' }, 'Ilość'));
  headerRow.appendChild(el('th', { className: 'text-right' }, 'Przychód'));
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = el('tbody');
  let grandRevenue = 0;

  for (const cs of summaryData) {
    if (cs.services.length === 0) {
      const row = el('tr');
      row.appendChild(el('td', { className: 'font-semibold' }, cs.contractorName));
      row.appendChild(el('td', { className: 'text-secondary' }, 'Brak aktywnych usług'));
      row.appendChild(el('td', {}));
      row.appendChild(el('td', {}));
      tbody.appendChild(row);
      continue;
    }

    for (let i = 0; i < cs.services.length; i++) {
      const svc = cs.services[i];
      const row = el('tr');

      if (i === 0) {
        row.appendChild(el('td', {
          className: 'font-semibold',
          rowspan: String(cs.services.length),
        }, cs.contractorName));
      }

      row.appendChild(el('td', {}, `${svc.serviceName} (${formatUnit(svc.unit)})`));
      row.appendChild(el('td', { className: 'cell-number' }, String(svc.quantity)));
      row.appendChild(el('td', { className: 'cell-number' }, formatCurrency(svc.revenue)));

      tbody.appendChild(row);
    }

    grandRevenue += cs.totalRevenue;
  }

  // Grand total row
  const totalRow = el('tr', { className: 'total-row' });
  totalRow.appendChild(el('td', { colspan: '3' }, 'SUMA PRZYCHODÓW'));
  totalRow.appendChild(el('td', { className: 'cell-number' }, formatCurrency(grandRevenue)));
  tbody.appendChild(totalRow);

  table.appendChild(tbody);
  tableSection.appendChild(table);
  wrapper.appendChild(tableSection);

  // Chart
  const chartData = getDailyChartData(filters.month, filters.contractorIds, filters.warehouseId);
  const chart = LineChartCanvas({
    data: chartData,
    title: `Przychód dzienny — ${getMonthLabel(filters.month)}`,
  });
  wrapper.appendChild(el('div', { className: 'mt-md' }, chart));

  return wrapper;
}
