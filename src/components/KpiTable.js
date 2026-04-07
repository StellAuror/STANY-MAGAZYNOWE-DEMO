import { el, showMultiPrompt } from '../utils/dom.js';
import { getActiveWarehouseId, getSelectedDate, getActiveKpisForWarehouse, getKpiValue } from '../store/selectors.js';
import { saveKpiValue } from '../store/actions.js';
import { today } from '../utils/date.js';

/**
 * KPI tab - shows KPI indicators for the active warehouse and selected date.
 * Each KPI is shown once per assigned contractor (or once if no contractors).
 */
export function KpiTable() {
  const warehouseId = getActiveWarehouseId();
  const selectedDate = getSelectedDate();
  const todayStr = today();

  const wrapper = el('div');

  const activeKpis = warehouseId ? getActiveKpisForWarehouse(warehouseId) : [];

  if (!warehouseId) {
    wrapper.appendChild(el('p', { className: 'text-secondary text-center', style: { padding: '40px' } },
      'Wybierz magazyn, aby zobaczyć KPI.'));
    return wrapper;
  }

  if (activeKpis.length === 0) {
    const msg = el('div', { className: 'kpi-empty-state' });
    msg.appendChild(el('p', { className: 'text-secondary text-center', style: { padding: '40px 24px 16px' } },
      'Brak wskaźników KPI przypisanych do tego magazynu.'));
    msg.appendChild(el('p', { className: 'text-secondary text-center', style: { paddingBottom: '40px', fontSize: '0.9rem' } },
      'Przejdź do zakładki \u201eMagazyny/Projekty\u201d, aby zdefiniować KPI i przypisać je do magazynów.'));
    wrapper.appendChild(msg);
    return wrapper;
  }

  // Expand assignments: one row per contractor (or one row if no contractors)
  const rows = [];
  for (const assignment of activeKpis) {
    const def = assignment.definition;
    const contractors = assignment.contractors || [];
    if (contractors.length === 0) {
      rows.push({ def, contractor: null });
    } else {
      for (const c of contractors) {
        rows.push({ def, contractor: c });
      }
    }
  }

  const table = el('table', { className: 'data-table' });

  // Header
  const thead = el('thead');
  const headerRow = el('tr');
  headerRow.appendChild(el('th', {}, 'Wskaźnik KPI'));
  headerRow.appendChild(el('th', {}, 'Kontrahent'));
  headerRow.appendChild(el('th', {}, 'Osoba odpowiedzialna'));
  headerRow.appendChild(el('th', {}, 'Proces'));
  headerRow.appendChild(el('th', {}, 'Grupowanie'));
  headerRow.appendChild(el('th', { className: 'text-right' }, 'Wartość'));
  headerRow.appendChild(el('th', {}, 'Uwaga'));
  headerRow.appendChild(el('th', { className: 'text-center' }, 'Wprowadzono'));
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = el('tbody');
  const isFuture = selectedDate > todayStr;

  for (const { def, contractor } of rows) {
    const contractorId = contractor ? contractor.id : null;
    const record = getKpiValue(warehouseId, def.id, selectedDate, contractorId);

    const row = el('tr');

    row.appendChild(el('td', { className: 'font-semibold' }, def.name));

    // Contractor cell
    row.appendChild(el('td', {}, contractor ? contractor.name : '—'));

    row.appendChild(el('td', {}, def.responsible || '—'));
    row.appendChild(el('td', { className: 'text-secondary', style: { fontSize: '0.85rem' } }, def.proces || '—'));
    row.appendChild(el('td', { className: 'text-secondary', style: { fontSize: '0.85rem' } }, def.grupowanie || '—'));

    // Value cell – clickable to open input
    const valueDisplay = record != null ? String(record.value) : '—';
    const valueCell = el('td', {
      className: `cell-number ${isFuture ? '' : 'cell-clickable'}`,
      title: isFuture ? 'Nie można wprowadzać danych dla przyszłych dat' : 'Kliknij, aby wprowadzić wartość',
      onClick: isFuture ? null : () => handleEnterValue(warehouseId, def, selectedDate, contractorId),
    }, valueDisplay);
    if (!isFuture) valueCell.style.cursor = 'pointer';
    row.appendChild(valueCell);

    // Note cell
    const noteCell = el('td', { className: 'text-secondary', style: { fontSize: '0.85rem', maxWidth: '160px' } },
      record?.note || '—');
    row.appendChild(noteCell);

    // Status cell
    const statusCell = el('td', { className: 'text-center' });
    if (record != null) {
      const timeStr = record.createdAt
        ? new Date(record.createdAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
        : '';
      statusCell.appendChild(el('span', {
        className: 'badge badge-success badge-time',
        title: record.updatedAt
          ? `Zaktualizowano: ${new Date(record.updatedAt).toLocaleString('pl-PL')}`
          : record.createdAt
            ? `Wprowadzono: ${new Date(record.createdAt).toLocaleString('pl-PL')}`
            : 'Dane wprowadzone',
      }, `\u2713 ${timeStr}`));
    } else {
      statusCell.appendChild(el('span', { className: 'badge badge-secondary' }, '\u2014'));
    }
    row.appendChild(statusCell);

    tbody.appendChild(row);
  }

  table.appendChild(tbody);
  wrapper.appendChild(table);

  return wrapper;
}

async function handleEnterValue(warehouseId, def, date, contractorId) {
  const current = getKpiValue(warehouseId, def.id, date, contractorId);
  const unitHint = def.description ? ` (${def.description})` : '';
  const result = await showMultiPrompt(`KPI: ${def.name}`, [
    {
      label: `Wartość${unitHint}`,
      key: 'value',
      required: true,
      defaultValue: current != null ? String(current.value) : '',
      placeholder: 'np. 42',
    },
    {
      label: 'Uwaga (opcjonalnie)',
      key: 'note',
      required: false,
      defaultValue: current?.note || '',
      placeholder: 'np. dane szacunkowe',
    },
  ]);
  if (!result) return;
  const raw = result.value.trim().replace(',', '.');
  const num = parseFloat(raw);
  const note = result.note?.trim() || '';
  if (isNaN(num)) {
    await saveKpiValue(warehouseId, def.id, date, result.value.trim(), contractorId, note);
  } else {
    await saveKpiValue(warehouseId, def.id, date, num, contractorId, note);
  }
}
