import { el, clearElement } from '../utils/dom.js';
import {
  getContractors, getWarehouses, getSummaryFilters,
} from '../store/selectors.js';
import { setSelectedMonth, setSummaryContractors, setSummaryWarehouse } from '../store/actions.js';
import { getState } from '../store/store.js';
import { getMonthlySummary, getDailyChartData, getTop5ByRevenue, getTop5MoMGrowth } from '../services/summaryService.js';
import { formatCurrency, formatUnit } from '../utils/format.js';
import { getMonthLabel } from '../utils/date.js';
import { BarChartCanvas } from './LineChartCanvas.js';

/**
 * View 3: Monthly summary with bar chart on top, filters, table, and TOP5 sections.
 */
export function MonthlySummary() {
  const contractors = getContractors();
  const warehouses = getWarehouses();
  const filters = getSummaryFilters();

  const wrapper = el('div');

  // === TOP FILTERS BAR (month + warehouse) ===
  const filtersBar = el('div', { className: 'settings-bar' });

  filtersBar.appendChild(el('label', {}, 'Miesiąc:'));
  const monthInput = el('input', {
    type: 'month',
    value: filters.month,
    onChange: (e) => setSelectedMonth(e.target.value),
  });
  filtersBar.appendChild(monthInput);

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

  // === BAR CHART (on top, shows all selected contractors) ===
  const selectedIds = filters.contractorIds.length > 0
    ? filters.contractorIds
    : contractors.map(c => c.id);

  const chartData = getDailyChartData(filters.month, selectedIds, filters.warehouseId);
  const chart = BarChartCanvas({
    data: chartData,
    title: `Przychód dzienny — ${getMonthLabel(filters.month)}`,
  });
  wrapper.appendChild(el('div', { className: 'mt-md' }, chart));

  // === TOP5 SECTIONS ===
  const top5Revenue = getTop5ByRevenue(filters.month, filters.warehouseId);
  const top5MoM = getTop5MoMGrowth(filters.month, filters.warehouseId);

  const top5Section = el('div', { className: 'top5-grid mt-md' });

  // TOP5 by Revenue
  const revenueCard = el('div', { className: 'top5-card' });
  revenueCard.appendChild(el('div', { className: 'top5-card__title' }, 'TOP 5 — Przychody'));

  const revTable = el('table', { className: 'summary-table' });
  const revThead = el('thead');
  const revHeaderRow = el('tr');
  revHeaderRow.appendChild(el('th', {}, '#'));
  revHeaderRow.appendChild(el('th', {}, 'Kontrahent'));
  revHeaderRow.appendChild(el('th', { className: 'text-right' }, 'Ruchy mag.'));
  revHeaderRow.appendChild(el('th', { className: 'text-right' }, 'Usługi dod.'));
  revHeaderRow.appendChild(el('th', { className: 'text-right' }, 'Stan mag.'));
  revHeaderRow.appendChild(el('th', { className: 'text-right' }, 'SUMA'));
  revThead.appendChild(revHeaderRow);
  revTable.appendChild(revThead);

  const revTbody = el('tbody');
  for (let i = 0; i < top5Revenue.length; i++) {
    const item = top5Revenue[i];
    const row = el('tr');
    row.appendChild(el('td', {}, el('span', { className: 'rank-badge' }, String(i + 1))));
    row.appendChild(el('td', { className: 'font-semibold' }, item.contractorName));
    row.appendChild(el('td', { className: 'cell-number' }, formatCurrency(item.movementRevenue)));
    row.appendChild(el('td', { className: 'cell-number' }, formatCurrency(item.additionalRevenue)));
    row.appendChild(el('td', { className: 'cell-number' }, formatCurrency(item.storageRevenue)));
    row.appendChild(el('td', { className: 'cell-number font-semibold' }, formatCurrency(item.totalRevenue)));
    revTbody.appendChild(row);
  }
  revTable.appendChild(revTbody);
  revenueCard.appendChild(revTable);
  top5Section.appendChild(revenueCard);

  // TOP5 by MoM Growth
  const momCard = el('div', { className: 'top5-card' });
  momCard.appendChild(el('div', { className: 'top5-card__title' }, 'TOP 5 — Wzrost MoM'));

  const momTable = el('table', { className: 'summary-table' });
  const momThead = el('thead');
  const momHeaderRow = el('tr');
  momHeaderRow.appendChild(el('th', {}, '#'));
  momHeaderRow.appendChild(el('th', {}, 'Kontrahent'));
  momHeaderRow.appendChild(el('th', { className: 'text-right' }, 'Poprz. mies.'));
  momHeaderRow.appendChild(el('th', { className: 'text-right' }, 'Bież. mies.'));
  momHeaderRow.appendChild(el('th', { className: 'text-right' }, 'MoM %'));
  momThead.appendChild(momHeaderRow);
  momTable.appendChild(momThead);

  const momTbody = el('tbody');
  for (let i = 0; i < top5MoM.length; i++) {
    const item = top5MoM[i];
    const row = el('tr');
    row.appendChild(el('td', {}, el('span', { className: 'rank-badge' }, String(i + 1))));
    row.appendChild(el('td', { className: 'font-semibold' }, item.contractorName));
    row.appendChild(el('td', { className: 'cell-number' }, formatCurrency(item.previousRevenue)));
    row.appendChild(el('td', { className: 'cell-number' }, formatCurrency(item.currentRevenue)));

    // MoM badge
    let momContent;
    if (item.isNew) {
      momContent = el('span', { className: 'mom-new' }, 'NOWY');
    } else {
      const momClass = item.momPercent > 0 ? 'mom-positive' : item.momPercent < 0 ? 'mom-negative' : '';
      const prefix = item.momPercent > 0 ? '+' : '';
      momContent = el('span', { className: momClass }, `${prefix}${item.momPercent}%`);
    }
    const momCell = el('td', { className: 'cell-number' });
    momCell.appendChild(momContent);
    row.appendChild(momCell);

    momTbody.appendChild(row);
  }
  momTable.appendChild(momTbody);
  momCard.appendChild(momTable);
  top5Section.appendChild(momCard);

  wrapper.appendChild(top5Section);

  // === CONTRACTOR MULTI-SELECT ===
  const contractorFilter = el('div', { className: 'settings-bar mt-md' });
  contractorFilter.appendChild(el('label', {}, 'Kontrahenci:'));

  const checkboxesContainer = el('div', { className: 'flex gap-sm', style: { flexWrap: 'wrap' } });

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

  // === SUMMARY TABLE (bottom) ===
  if (filters.contractorIds.length === 0) {
    wrapper.appendChild(el('p', { className: 'text-secondary text-center mt-lg' },
      'Wybierz co najmniej jednego kontrahenta, aby wyświetlić szczegółowe podsumowanie.'));
    return wrapper;
  }

  const summaryData = getMonthlySummary(filters.month, filters.contractorIds, filters.warehouseId);

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

  return wrapper;
}
