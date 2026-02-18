import { el, clearElement } from '../utils/dom.js';
import {
  getContractors, getWarehouses, getSummaryFilters, getSummaryReportContractorId,
} from '../store/selectors.js';
import { setSelectedMonth, setSummaryWarehouse, setSummaryReportContractor } from '../store/actions.js';
import { getDailyChartData, getTop5ByRevenue, getTop5MoMGrowth, getContractorDailyReport } from '../services/summaryService.js';
import { formatCurrency } from '../utils/format.js';
import { getMonthLabel, formatDatePL } from '../utils/date.js';
import { BarChartCanvas } from './LineChartCanvas.js';

// Module-level state for report mode toggle
let reportMode = 'warehouse'; // 'warehouse' | 'transport'

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
  revHeaderRow.appendChild(el('th', { className: 'text-right' }, 'VASY / Transport'));
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

  // === RAPORT KONTRAHENTA — DROPDOWN + DZIENNY BREAKDOWN ===
  const reportSection = el('div', { className: 'section mt-md' });
  const reportTitleRow = el('div', { className: 'flex items-center gap-sm', style: { marginBottom: '12px' } });

  const contractorSelect = el('select', {
    style: { minWidth: '200px' },
    onChange: (e) => setSummaryReportContractor(e.target.value || null),
  });
  contractorSelect.appendChild(el('option', { value: '' }, '-- Wybierz kontrahenta --'));
  const reportContractorId = getSummaryReportContractorId();
  for (const c of contractors) {
    const opt = el('option', { value: c.id }, c.name);
    if (c.id === reportContractorId) opt.selected = true;
    contractorSelect.appendChild(opt);
  }
  reportTitleRow.appendChild(contractorSelect);
  reportTitleRow.appendChild(el('div', { className: 'section__title', style: { margin: 0, border: 'none', flex: '1' } }, 'Raport kontrahenta'));
  reportSection.appendChild(reportTitleRow);

  if (!reportContractorId) {
    reportSection.appendChild(el('p', { className: 'text-secondary' },
      'Wybierz kontrahenta, aby zobaczyć szczegółowy raport miesięczny.'));
    wrapper.appendChild(reportSection);
    return wrapper;
  }

  const reportContractor = contractors.find(c => c.id === reportContractorId);
  const dailyReport = getContractorDailyReport(filters.month, reportContractorId, filters.warehouseId);
  const activeDays = dailyReport.filter(d => d.lines.length > 0);

  if (activeDays.length === 0) {
    reportSection.appendChild(el('p', { className: 'text-secondary' }, 'Brak aktywności w tym miesiącu.'));
    wrapper.appendChild(reportSection);
    return wrapper;
  }

  // Split daily report into two streams: Transport vs. the rest
  const transportDays = activeDays
    .map(d => ({ ...d, lines: d.lines.filter(l => l.category === 'Transport') }))
    .filter(d => d.lines.length > 0)
    .map(d => ({ ...d, dayTotal: Math.round(d.lines.reduce((s, l) => s + l.total, 0) * 100) / 100 }));

  const otherDays = activeDays
    .map(d => ({ ...d, lines: d.lines.filter(l => l.category !== 'Transport') }))
    .filter(d => d.lines.length > 0)
    .map(d => ({ ...d, dayTotal: Math.round(d.lines.reduce((s, l) => s + l.total, 0) * 100) / 100 }));

  const categoryColors = {
    'Ruchy magazynowe': '#2563eb',
    'Transport': '#0891b2',
    'VASY': '#7c3aed',
    'Stan magazynowy': '#059669',
  };

  /**
   * Build a daily-breakdown table for a subset of days.
   */
  function buildReportTable(days) {
    const table = el('table', { className: 'summary-table' });
    const thead = el('thead');
    const hdr = el('tr');
    hdr.appendChild(el('th', {}, 'Data'));
    hdr.appendChild(el('th', {}, 'Kategoria'));
    hdr.appendChild(el('th', {}, 'Pozycja'));
    hdr.appendChild(el('th', { className: 'text-right' }, 'Ilość'));
    hdr.appendChild(el('th', { className: 'text-right' }, 'Cena'));
    hdr.appendChild(el('th', { className: 'text-right' }, 'Wartość'));
    thead.appendChild(hdr);
    table.appendChild(thead);

    const tbody = el('tbody');

    for (const day of days) {
      const rowspan = day.lines.length;
      for (let i = 0; i < day.lines.length; i++) {
        const line = day.lines[i];
        const row = el('tr');

        if (i === 0) {
          const dateCell = el('td', {
            rowspan: String(rowspan),
            className: 'font-semibold',
            style: { whiteSpace: 'nowrap', verticalAlign: 'top', paddingTop: '10px' },
          }, formatDatePL(day.date));
          row.appendChild(dateCell);
        }

        const catColor = categoryColors[line.category] || 'var(--color-text-secondary)';
        const catCell = el('td', {});
        catCell.appendChild(el('span', {
          style: {
            fontSize: '0.72rem', fontWeight: '700', padding: '2px 7px',
            borderRadius: '999px', background: catColor + '1a', color: catColor,
            textTransform: 'uppercase', letterSpacing: '0.04em',
          },
        }, line.category));
        row.appendChild(catCell);

        row.appendChild(el('td', {}, line.name));
        row.appendChild(el('td', { className: 'cell-number' }, String(line.qty)));
        row.appendChild(el('td', { className: 'cell-number' }, formatCurrency(line.price)));
        row.appendChild(el('td', { className: 'cell-number' }, formatCurrency(line.total)));
        tbody.appendChild(row);
      }

      // Day subtotal
      const subtotalRow = el('tr', { style: { background: '#f8fafc', borderTop: '1px solid var(--color-border)' } });
      subtotalRow.appendChild(el('td', { colspan: '5', style: { textAlign: 'right', fontWeight: '600', fontSize: '0.85rem', color: 'var(--color-text-secondary)', padding: '4px 12px' } }, `Suma ${formatDatePL(day.date)}:`));
      subtotalRow.appendChild(el('td', { className: 'cell-number font-semibold' }, formatCurrency(day.dayTotal)));
      tbody.appendChild(subtotalRow);
    }

    // Grand total for this section
    const sectionTotal = Math.round(days.reduce((s, d) => s + d.dayTotal, 0) * 100) / 100;
    const grandRow = el('tr', { className: 'total-row' });
    grandRow.appendChild(el('td', { colspan: '5' }, 'SUMA MIESIĄCA'));
    grandRow.appendChild(el('td', { className: 'cell-number' }, formatCurrency(sectionTotal)));
    tbody.appendChild(grandRow);

    table.appendChild(tbody);
    return { table, total: sectionTotal };
  }

  /**
   * Build a titled subsection card with export buttons and table.
   */
  function buildSubSection(title, accentColor, days, csvLabel) {
    const section = el('div', { className: 'report-subsection' });

    const titleRow = el('div', { className: 'report-subsection__header' });
    titleRow.appendChild(el('span', {
      className: 'report-subsection__badge',
      style: { background: accentColor + '1a', color: accentColor },
    }, title));

    const btnGroup = el('div', { className: 'flex gap-sm' });
    btnGroup.appendChild(el('button', {
      className: 'btn-secondary btn-small',
      onClick: () => exportCSV(days, reportContractor?.name, filters.month, csvLabel),
    }, '⬇ CSV'));
    btnGroup.appendChild(el('button', {
      className: 'btn-primary btn-small',
      onClick: () => exportPDF(days, reportContractor?.name, filters.month, title),
    }, '⬇ PDF'));
    titleRow.appendChild(btnGroup);
    section.appendChild(titleRow);

    const { table } = buildReportTable(days);
    section.appendChild(table);
    return section;
  }

  // --- Report mode switcher ---
  const switcherRow = el('div', { className: 'report-mode-switcher' });

  const modes = [
    { id: 'warehouse', label: 'Raport magazynowy', color: '#2563eb' },
    { id: 'transport', label: 'Raport transportowy', color: '#0891b2' },
  ];

  const switchBtns = {};
  for (const mode of modes) {
    const btn = el('button', {
      className: 'report-mode-switcher__btn' + (reportMode === mode.id ? ' report-mode-switcher__btn--active' : ''),
      style: reportMode === mode.id ? { '--accent': mode.color } : {},
      onClick: () => {
        reportMode = mode.id;
        // Re-render content pane only
        renderContent();
        // Update button states
        for (const [mid, b] of Object.entries(switchBtns)) {
          const m = modes.find(x => x.id === mid);
          b.className = 'report-mode-switcher__btn' + (mid === reportMode ? ' report-mode-switcher__btn--active' : '');
          b.style.setProperty('--accent', mid === reportMode ? m.color : 'transparent');
        }
      },
    }, mode.label);
    if (reportMode === mode.id) btn.style.setProperty('--accent', mode.color);
    switchBtns[mode.id] = btn;
    switcherRow.appendChild(btn);
  }
  reportSection.appendChild(switcherRow);

  // Content pane — swapped by switcher
  const contentPane = el('div', { className: 'report-content-pane' });
  reportSection.appendChild(contentPane);

  function renderContent() {
    clearElement(contentPane);
    const activeDays = reportMode === 'transport' ? transportDays : otherDays;
    const title    = reportMode === 'transport' ? 'Transport' : 'Pozostałe usługi';
    const color    = reportMode === 'transport' ? '#0891b2'   : '#2563eb';
    const csvLabel = reportMode === 'transport' ? 'transport' : 'pozostale';

    if (activeDays.length === 0) {
      contentPane.appendChild(el('p', {
        className: 'text-secondary',
        style: { padding: '20px 0' },
      }, 'Brak danych dla tej kategorii w wybranym miesiącu.'));
      return;
    }

    // Export buttons bar
    const exportRow = el('div', { className: 'report-export-bar' });
    exportRow.appendChild(el('span', { className: 'text-secondary', style: { fontSize: '0.85rem' } },
      `${reportContractor?.name} — ${getMonthLabel(filters.month)}`));
    const btnGroup = el('div', { className: 'flex gap-sm' });
    btnGroup.appendChild(el('button', {
      className: 'btn-secondary btn-small',
      onClick: () => exportCSV(activeDays, reportContractor?.name, filters.month, csvLabel),
    }, '⬇ CSV'));
    btnGroup.appendChild(el('button', {
      className: 'btn-primary btn-small',
      onClick: () => exportPDF(activeDays, reportContractor?.name, filters.month, title),
    }, '⬇ PDF'));
    exportRow.appendChild(btnGroup);
    contentPane.appendChild(exportRow);

    const { table } = buildReportTable(activeDays);
    contentPane.appendChild(table);
  }

  renderContent();

  wrapper.appendChild(reportSection);

  return wrapper;
}

// ── Export helpers ────────────────────────────────────────────────────────────

function exportCSV(days, contractorName, month, sectionLabel) {
  const rows = [['Data', 'Kategoria', 'Pozycja', 'Ilość', 'Cena', 'Wartość']];
  for (const day of days) {
    for (const line of day.lines) {
      rows.push([day.date, line.category, line.name, line.qty, line.price.toFixed(2), line.total.toFixed(2)]);
    }
    if (day.lines.length > 0) {
      rows.push([day.date, '', 'SUMA DNIA', '', '', day.dayTotal.toFixed(2)]);
    }
  }
  const grandTotal = days.reduce((s, d) => s + d.dayTotal, 0);
  rows.push(['', '', 'SUMA MIESIĄCA', '', '', grandTotal.toFixed(2)]);

  const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(';')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `raport_${contractorName}_${month}${sectionLabel ? '_' + sectionLabel : ''}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPDF(days, contractorName, month, sectionTitle) {
  const activeDays = days.filter(d => d.lines.length > 0);
  const grandTotal = activeDays.reduce((s, d) => s + d.dayTotal, 0);

  const categoryColors = {
    'Ruchy magazynowe': '#2563eb',
    'Transport': '#0891b2',
    'VASY': '#7c3aed',
    'Stan magazynowy': '#059669',
  };

  const rowsHTML = activeDays.map(day => {
    const lines = day.lines.map((line, i) => {
      const color = categoryColors[line.category] || '#6b7280';
      const dateCell = i === 0
        ? `<td rowspan="${day.lines.length}" style="font-weight:600;vertical-align:top;padding-top:10px;white-space:nowrap">${day.date}</td>`
        : '';
      return `<tr>
        ${dateCell}
        <td><span style="font-size:0.7rem;font-weight:700;padding:2px 7px;border-radius:999px;background:${color}22;color:${color};text-transform:uppercase">${line.category}</span></td>
        <td>${line.name}</td>
        <td style="text-align:right">${line.qty}</td>
        <td style="text-align:right">${line.price.toFixed(2)} zł</td>
        <td style="text-align:right;font-weight:600">${line.total.toFixed(2)} zł</td>
      </tr>`;
    }).join('');
    const subtotal = `<tr style="background:#f8fafc;border-top:1px solid #e5e7eb">
      <td colspan="5" style="text-align:right;font-weight:600;color:#6b7280;font-size:0.85rem;padding:4px 8px">Suma ${day.date}:</td>
      <td style="text-align:right;font-weight:700">${day.dayTotal.toFixed(2)} zł</td>
    </tr>`;
    return lines + subtotal;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<title>Raport — ${contractorName} — ${month}${sectionTitle ? ' — ' + sectionTitle : ''}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 13px; color: #1a1d23; margin: 32px; }
  h1 { font-size: 1.4rem; margin-bottom: 4px; }
  p { color: #6b7280; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f1f5f9; text-align: left; padding: 8px 10px; font-size: 0.8rem; text-transform: uppercase; letter-spacing: .05em; border-bottom: 2px solid #e5e7eb; }
  th:last-child, td:last-child, td:nth-child(4), td:nth-child(5) { text-align: right; }
  td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
  .total { font-weight: 700; background: #1e293b; color: #fff; }
  .total td { padding: 10px; }
  @media print { body { margin: 16px; } }
</style>
</head>
<body>
<h1>Raport miesięczny${sectionTitle ? ' — ' + sectionTitle : ''}</h1>
<p>${contractorName} &mdash; ${month}</p>
<table>
  <thead><tr>
    <th>Data</th><th>Kategoria</th><th>Pozycja</th>
    <th style="text-align:right">Ilość</th>
    <th style="text-align:right">Cena</th>
    <th style="text-align:right">Wartość</th>
  </tr></thead>
  <tbody>
    ${rowsHTML}
    <tr class="total"><td colspan="5">SUMA MIESIĄCA</td><td>${grandTotal.toFixed(2)} zł</td></tr>
  </tbody>
</table>
</body>
</html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}
