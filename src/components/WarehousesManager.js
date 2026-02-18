import { el, showMultiPrompt, showConfirm, showPrompt } from '../utils/dom.js';
import { getState } from '../store/store.js';
import {
  addWarehouse, updateWarehouse, deleteWarehouse,
  addKpiDefinition, updateKpiDefinition, deleteKpiDefinition,
  assignKpiToWarehouse, unassignKpiFromWarehouse,
} from '../store/actions.js';
import { getKpiDefinitions, getWarehouseKpis, getContractors } from '../store/selectors.js';

/**
 * Component for managing warehouses (Magazyny) and KPI definitions.
 */
export function WarehousesManager() {
  const { warehouses } = getState();
  const sorted = [...warehouses].sort((a, b) => a.sortOrder - b.sortOrder);

  const container = el('div', { className: 'view-container view-container--full' });

  // ── Warehouses Section ────────────────────────────────────────────
  const whHeader = el('div', { className: 'view-header flex items-center justify-between' });
  whHeader.appendChild(el('h2', {}, 'Magazyny'));
  const addWhBtn = el('button', {
    className: 'btn btn-primary',
    onClick: () => handleAddWarehouse(),
  }, '+ Dodaj magazyn');
  whHeader.appendChild(addWhBtn);
  container.appendChild(whHeader);

  container.appendChild(el('p', { className: 'view-note' },
    'Magazyny są widoczne w przełączniku w górnym pasku aplikacji. ' +
    'Możesz dowolnie dodawać, zmieniać nazwy i usuwać magazyny.'
  ));

  const whTable = el('table', { className: 'data-table' });
  const whThead = el('thead');
  const whHeaderRow = el('tr');
  whHeaderRow.appendChild(el('th', { style: { width: '48px' } }, 'Lp.'));
  whHeaderRow.appendChild(el('th', {}, 'Nazwa magazynu'));
  whHeaderRow.appendChild(el('th', { className: 'text-right', style: { width: '220px' } }, 'Akcje'));
  whThead.appendChild(whHeaderRow);
  whTable.appendChild(whThead);

  const whTbody = el('tbody');
  if (sorted.length === 0) {
    const emptyRow = el('tr');
    emptyRow.appendChild(el('td', {
      colspan: '3',
      className: 'text-center text-secondary',
      style: { padding: '24px' },
    }, 'Brak magazynów. Kliknij "+ Dodaj magazyn", aby dodać pierwszy.'));
    whTbody.appendChild(emptyRow);
  } else {
    sorted.forEach((wh, idx) => {
      const row = el('tr', { className: 'warehouse-row' });
      row.appendChild(el('td', { className: 'text-secondary', style: { width: '48px' } }, String(idx + 1)));
      const nameCell = el('td', {});
      nameCell.appendChild(el('span', { className: 'warehouse-name-text font-semibold' }, wh.name));
      row.appendChild(nameCell);
      const actionsCell = el('td', { style: { width: '220px' } });
      const actionsWrap = el('div', { className: 'warehouse-actions' });
      const editBtn = el('button', {
        className: 'btn btn-sm btn-secondary',
        onClick: () => handleEditWarehouse(wh),
      }, 'Zmień nazwę');
      const deleteBtn = el('button', {
        className: 'btn btn-sm btn-danger',
        onClick: () => handleDeleteWarehouse(wh),
        title: 'Usuń magazyn',
      }, 'Usuń');
      if (sorted.length === 1) {
        deleteBtn.disabled = true;
        deleteBtn.title = 'Nie można usunąć ostatniego magazynu';
      }
      actionsWrap.appendChild(editBtn);
      actionsWrap.appendChild(deleteBtn);
      actionsCell.appendChild(actionsWrap);
      row.appendChild(actionsCell);
      whTbody.appendChild(row);
    });
  }
  whTable.appendChild(whTbody);
  container.appendChild(whTable);

  // ── KPI Definitions Section ───────────────────────────────────────
  container.appendChild(el('hr', { style: { margin: '32px 0 24px', borderColor: 'var(--color-border)' } }));

  const kpiHeader = el('div', { className: 'view-header flex items-center justify-between' });
  kpiHeader.appendChild(el('h2', {}, 'Definicje KPI'));
  const addKpiBtn = el('button', {
    className: 'btn btn-primary',
    onClick: () => handleAddKpi(),
  }, '+ Dodaj KPI');
  kpiHeader.appendChild(addKpiBtn);
  container.appendChild(kpiHeader);

  container.appendChild(el('p', { className: 'view-note' },
    'Zdefiniuj wskaźniki KPI, a następnie przypisz je do wybranych magazynów. ' +
    'Wartości KPI wprowadza się na zakładce "KPI" dla wybranego magazynu i dnia.'
  ));

  const kpiDefs = getKpiDefinitions();

  if (kpiDefs.length === 0) {
    container.appendChild(el('p', {
      className: 'text-secondary text-center',
      style: { padding: '24px' },
    }, 'Brak zdefiniowanych KPI. Kliknij "+ Dodaj KPI", aby dodać pierwszy.'));
  } else {
    const kpiTable = el('table', { className: 'data-table' });
    const kpiThead = el('thead');
    const kpiHRow = el('tr');
    kpiHRow.appendChild(el('th', {}, 'Nazwa KPI'));
    kpiHRow.appendChild(el('th', {}, 'Osoba odpowiedzialna'));
    kpiHRow.appendChild(el('th', {}, 'Opis'));
    kpiHRow.appendChild(el('th', {}, 'Magazyny'));
    kpiHRow.appendChild(el('th', {}, 'Kontrahenci'));
    kpiHRow.appendChild(el('th', { className: 'text-right', style: { width: '160px' } }, 'Akcje'));
    kpiThead.appendChild(kpiHRow);
    kpiTable.appendChild(kpiThead);

    const kpiTbody = el('tbody');
    const contractors = getContractors();
    for (const kpi of kpiDefs) {
      const row = el('tr');
      row.appendChild(el('td', { className: 'font-semibold' }, kpi.name));
      row.appendChild(el('td', {}, kpi.responsible || '—'));
      row.appendChild(el('td', { className: 'text-secondary', style: { fontSize: '0.85rem' } }, kpi.description || '—'));

      // ── Warehouse multi-select dropdown ──────────────────────────
      const whCell = el('td');
      const whOptions = sorted.map(wh => {
        const assignments = getWarehouseKpis(wh.id);
        return { id: wh.id, label: wh.name, selected: assignments.some(wk => wk.kpiId === kpi.id) };
      });
      whCell.appendChild(MultiSelectDropdown(
        whOptions,
        'Brak magazynów',
        async (id, selected) => {
          if (selected) await assignKpiToWarehouse(id, kpi.id);
          else await unassignKpiFromWarehouse(id, kpi.id);
        }
      ));
      row.appendChild(whCell);

      // ── Contractor multi-select dropdown ─────────────────────────
      const ctCell = el('td');
      const currentCtIds = Array.isArray(kpi.contractorIds) ? kpi.contractorIds
        : (kpi.contractorId ? [kpi.contractorId] : []);
      const ctOptions = contractors.map(c => ({
        id: c.id, label: c.name, selected: currentCtIds.includes(c.id),
      }));
      ctCell.appendChild(MultiSelectDropdown(
        ctOptions,
        'Brak',
        async (id, selected) => {
          const prev = Array.isArray(kpi.contractorIds) ? [...kpi.contractorIds]
            : (kpi.contractorId ? [kpi.contractorId] : []);
          const next = selected ? [...new Set([...prev, id])] : prev.filter(x => x !== id);
          kpi.contractorIds = next;
          await updateKpiDefinition(kpi.id, { contractorIds: next, contractorId: null });
        }
      ));
      row.appendChild(ctCell);

      // Actions
      const actCell = el('td');
      const actWrap = el('div', { className: 'warehouse-actions' });
      const editKpiBtn = el('button', {
        className: 'btn btn-sm btn-secondary',
        onClick: () => handleEditKpi(kpi),
      }, 'Edytuj');
      const deleteKpiBtn = el('button', {
        className: 'btn btn-sm btn-danger',
        onClick: () => handleDeleteKpi(kpi),
      }, 'Usuń');
      actWrap.appendChild(editKpiBtn);
      actWrap.appendChild(deleteKpiBtn);
      actCell.appendChild(actWrap);
      row.appendChild(actCell);

      kpiTbody.appendChild(row);
    }
    kpiTable.appendChild(kpiTbody);
    container.appendChild(kpiTable);
  }

  return container;
}

// ── Warehouse handlers ────────────────────────────────────────────

async function handleAddWarehouse() {
  const name = await showPrompt('Nazwa nowego magazynu:');
  if (!name || !name.trim()) return;
  await addWarehouse(name.trim());
}

async function handleEditWarehouse(wh) {
  const name = await showPrompt('Nowa nazwa magazynu:', wh.name);
  if (!name || !name.trim()) return;
  if (name.trim() === wh.name) return;
  await updateWarehouse(wh.id, { name: name.trim() });
}

async function handleDeleteWarehouse(wh) {
  const confirmed = await showConfirm(
    `Czy na pewno chcesz usunąć magazyn „${wh.name}"?\n\n` +
    'Uwaga: usunięcie magazynu nie usuwa powiązanych wpisów stanów magazynowych ani wartości KPI.'
  );
  if (!confirmed) return;
  await deleteWarehouse(wh.id);
}

// ── KPI handlers ──────────────────────────────────────────────────

async function handleAddKpi() {
  const result = await showMultiPrompt('Nowy wskaźnik KPI', [
    { label: 'Nazwa KPI', key: 'name', required: true, placeholder: 'np. Czas obsługi zamówienia' },
    { label: 'Osoba odpowiedzialna', key: 'responsible', placeholder: 'np. Jan Kowalski' },
    { label: 'Opis / jednostka miary (opcjonalnie)', key: 'description', placeholder: 'np. minuty, szt., %' },
  ]);
  if (!result) return;
  await addKpiDefinition(
    result.name.trim(),
    (result.responsible || '').trim(),
    (result.description || '').trim()
  );
}

async function handleEditKpi(kpi) {
  const result = await showMultiPrompt('Edytuj KPI', [
    { label: 'Nazwa KPI', key: 'name', required: true, defaultValue: kpi.name },
    { label: 'Osoba odpowiedzialna', key: 'responsible', defaultValue: kpi.responsible || '' },
    { label: 'Opis / jednostka miary', key: 'description', defaultValue: kpi.description || '' },
  ]);
  if (!result) return;
  await updateKpiDefinition(kpi.id, {
    name: result.name.trim(),
    responsible: (result.responsible || '').trim(),
    description: (result.description || '').trim(),
  });
}

async function handleDeleteKpi(kpi) {
  const confirmed = await showConfirm(
    `Czy na pewno chcesz usunąć KPI „${kpi.name}"?\n\n` +
    'Usunie to również wszystkie przypisania do magazynów.'
  );
  if (!confirmed) return;
  await deleteKpiDefinition(kpi.id);
}
/**
 * Custom multi-select dropdown with checkboxes.
 * @param {{ id: string, label: string, selected: boolean }[]} options
 * @param {string} emptyLabel - shown when nothing selected
 * @param {(id: string, selected: boolean) => Promise<void>} onChange
 */
function MultiSelectDropdown(options, emptyLabel, onChange) {
  const wrapper = el('div', { className: 'msd-wrapper' });

  const toggle = el('button', { className: 'msd-toggle', type: 'button' });
  // Panel is appended to body so it escapes any overflow:hidden ancestor
  const panel = el('div', { className: 'msd-panel' });
  document.body.appendChild(panel);
  let isOpen = false;
  let closeHandler = null;

  const state = options.map(o => ({ ...o })); // local mutable copy

  function renderLabel() {
    const sel = state.filter(o => o.selected);
    toggle.textContent = '';
    if (sel.length === 0) {
      toggle.appendChild(el('span', { className: 'msd-empty' }, emptyLabel));
    } else if (sel.length <= 2) {
      sel.forEach(o => toggle.appendChild(el('span', { className: 'msd-chip' }, o.label)));
    } else {
      toggle.appendChild(el('span', { className: 'msd-chip' }, sel[0].label));
      toggle.appendChild(el('span', { className: 'msd-chip msd-chip--more' }, `+${sel.length - 1}`));
    }
    toggle.appendChild(el('span', { className: 'msd-arrow' }, '▾'));
  }

  function buildPanel() {
    panel.innerHTML = '';
    if (state.length === 0) {
      panel.appendChild(el('div', { className: 'msd-no-options' }, 'Brak opcji'));
      return;
    }
    for (const opt of state) {
      const item = el('label', { className: 'msd-item' });
      const cb = el('input', { type: 'checkbox' });
      cb.checked = opt.selected;
      cb.addEventListener('change', async () => {
        opt.selected = cb.checked;
        renderLabel();
        await onChange(opt.id, cb.checked);
      });
      item.appendChild(cb);
      item.appendChild(document.createTextNode('\u00a0' + opt.label));
      panel.appendChild(item);
    }
  }

  function positionPanel() {
    const rect = toggle.getBoundingClientRect();
    panel.style.top = (rect.bottom + window.scrollY + 3) + 'px';
    panel.style.left = (rect.left + window.scrollX) + 'px';
    panel.style.minWidth = rect.width + 'px';
  }

  function open() {
    isOpen = true;
    buildPanel();
    positionPanel();
    panel.classList.add('msd-panel--open');
    setTimeout(() => {
      closeHandler = (e) => {
        if (!wrapper.contains(e.target) && !panel.contains(e.target)) {
          close();
        }
      };
      document.addEventListener('mousedown', closeHandler);
    }, 0);
  }

  function close() {
    isOpen = false;
    panel.classList.remove('msd-panel--open');
    if (closeHandler) {
      document.removeEventListener('mousedown', closeHandler);
      closeHandler = null;
    }
  }

  // Clean up panel from body when wrapper is removed from DOM
  const observer = new MutationObserver(() => {
    if (!document.body.contains(wrapper)) {
      panel.remove();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  toggle.addEventListener('click', () => { if (isOpen) close(); else open(); });

  renderLabel();
  wrapper.appendChild(toggle);
  return wrapper;
}