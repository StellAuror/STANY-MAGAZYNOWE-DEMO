import { el, showMultiPrompt } from '../utils/dom.js';
import { getActiveWarehouseId, getSelectedDate, getActiveKpisForWarehouse, getKpiValue } from '../store/selectors.js';
import { saveKpiValue } from '../store/actions.js';
import { today } from '../utils/date.js';

/**
 * KPI tab - shows KPI indicators for the active warehouse and selected date.
 * Users can enter values per KPI per day per warehouse.
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
      'Przejdź do zakładki \u201eMagazyny\u201d, aby zdefiniować KPI i przypisać je do magazynów.'));
    wrapper.appendChild(msg);
    return wrapper;
  }

  const table = el('table', { className: 'data-table' });

  // Header
  const thead = el('thead');
  const headerRow = el('tr');
  headerRow.appendChild(el('th', {}, 'Wskaźnik KPI'));
  headerRow.appendChild(el('th', {}, 'Kontrahent'));
  headerRow.appendChild(el('th', {}, 'Osoba odpowiedzialna'));
  headerRow.appendChild(el('th', {}, 'Opis'));
  headerRow.appendChild(el('th', { className: 'text-right' }, 'Wartość'));
  headerRow.appendChild(el('th', { className: 'text-center' }, 'Wprowadzono'));
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = el('tbody');

  for (const assignment of activeKpis) {
    const def = assignment.definition;
    const assignedContractors = assignment.contractors || [];
    const record = getKpiValue(warehouseId, def.id, selectedDate);

    const row = el('tr');

    row.appendChild(el('td', { className: 'font-semibold' }, def.name));

    // Contractors cell – list chips or dash
    const ctCell = el('td');
    if (assignedContractors.length === 0) {
      ctCell.appendChild(el('span', { className: 'text-secondary' }, '—'));
    } else {
      const wrap = el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '4px' } });
      for (const c of assignedContractors) {
        wrap.appendChild(el('span', { className: 'msd-chip' }, c.name));
      }
      ctCell.appendChild(wrap);
    }
    row.appendChild(ctCell);

    row.appendChild(el('td', {}, def.responsible || '—'));
    row.appendChild(el('td', { className: 'text-secondary', style: { fontSize: '0.85rem' } }, def.description || '—'));

    // Value cell – clickable to open input
    const isFuture = selectedDate > todayStr;
    const valueDisplay = record != null ? String(record.value) : '—';
    const valueCell = el('td', {
      className: `cell-number ${isFuture ? '' : 'cell-clickable'}`,
      title: isFuture ? 'Nie można wprowadzać danych dla przyszłych dat' : 'Kliknij, aby wprowadzić wartość',
      onClick: isFuture ? null : () => handleEnterValue(warehouseId, def, selectedDate),
    }, valueDisplay);
    if (!isFuture) valueCell.style.cursor = 'pointer';
    row.appendChild(valueCell);

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

async function handleEnterValue(warehouseId, def, date) {
  const current = getKpiValue(warehouseId, def.id, date);
  const result = await showMultiPrompt(`KPI: ${def.name}`, [
    {
      label: `Wartość${def.description ? ' (' + def.description + ')' : ''}`,
      key: 'value',
      required: true,
      defaultValue: current != null ? String(current.value) : '',
      placeholder: 'np. 42',
    },
  ]);
  if (!result) return;
  const raw = result.value.trim().replace(',', '.');
  const num = parseFloat(raw);
  if (isNaN(num)) {
    // Accept also string values – store as-is
    await saveKpiValue(warehouseId, def.id, date, result.value.trim());
  } else {
    await saveKpiValue(warehouseId, def.id, date, num);
  }
}
