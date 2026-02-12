import { el } from '../utils/dom.js';
import { getAllAuditLog, getContractorById, getWarehouseById, getServiceDefinitionById } from '../store/selectors.js';

/** Action labels in Polish */
const ACTION_LABELS = {
  CREATE_INVENTORY: 'Utworzenie wpisu',
  UPDATE_INVENTORY: 'Edycja wpisu',
  MARK_DAY_COMPLETED: 'Oznaczenie dnia',
  ADD_PRICE: 'Dodanie ceny',
  UPDATE_PRICE: 'Zmiana ceny',
  ADD_PALLET_PRICE: 'Dodanie ceny palety',
  UPDATE_PALLET_PRICE: 'Zmiana ceny palety',
};

/** Entity type labels */
const ENTITY_LABELS = {
  DailyInventory: 'Dzienny wpis magazynowy',
  ServicePrice: 'Cena uslugi',
  PalletPrice: 'Cena palety',
};

/** Badge color class per action type */
function getActionBadgeClass(action) {
  if (action.startsWith('CREATE') || action.startsWith('ADD')) return 'audit-badge--create';
  if (action.startsWith('UPDATE')) return 'audit-badge--update';
  if (action.startsWith('MARK')) return 'audit-badge--mark';
  return 'audit-badge--default';
}

/**
 * Parse entityKey to human-readable description.
 * Keys look like: "ctr1|wh1|2026-01-15" or "ctr1|svc1"
 */
function describeEntityKey(entityType, entityKey) {
  const parts = entityKey.split('|');

  if (entityType === 'DailyInventory' && parts.length >= 3) {
    const contractor = getContractorById(parts[0]);
    const warehouse = getWarehouseById(parts[1]);
    const date = parts[2];
    const cName = contractor ? contractor.name : parts[0];
    const wName = warehouse ? warehouse.name : parts[1];
    return `${cName} — ${wName} — ${formatDatePL(date)}`;
  }

  if ((entityType === 'ServicePrice' || entityType === 'PalletPrice') && parts.length >= 2) {
    const contractor = getContractorById(parts[0]);
    const cName = contractor ? contractor.name : parts[0];
    const svcDef = getServiceDefinitionById(parts[1]);
    const sName = svcDef ? svcDef.name : parts[1];
    return `${cName} — ${sName}`;
  }

  return entityKey;
}

/** Format ISO date to Polish format */
function formatDatePL(isoDate) {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Format timestamp to Polish date+time */
function formatTimestampPL(ts) {
  const d = new Date(ts);
  return d.toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Summarize diff object to a short string */
function describeDiff(action, diff) {
  if (!diff) return '';

  if (action === 'ADD_PRICE' || action === 'ADD_PALLET_PRICE') {
    const price = diff.pricePerUnit != null ? Number(diff.pricePerUnit).toFixed(2) + ' zl' : '';
    const from = diff.effectiveFrom || '';
    return price && from ? `${price} od ${formatDatePL(from)}` : price || JSON.stringify(diff);
  }

  if (action === 'UPDATE_PRICE' || action === 'UPDATE_PALLET_PRICE') {
    const price = diff.pricePerUnit != null ? Number(diff.pricePerUnit).toFixed(2) + ' zl' : '';
    const from = diff.effectiveFrom || '';
    return price && from ? `${price} od ${formatDatePL(from)}` : price || JSON.stringify(diff);
  }

  if (action === 'CREATE_INVENTORY' || action === 'UPDATE_INVENTORY') {
    const after = diff.servicesAfter || [];
    let totalIn = 0;
    let totalOut = 0;
    for (const svc of after) {
      if (!svc.palletEntries) continue;
      const sum = svc.palletEntries.reduce((s, e) => s + (e.qty || 0), 0);
      if (svc.serviceId === 'svc-pallets-in') totalIn += sum;
      if (svc.serviceId === 'svc-pallets-out') totalOut += sum;
    }
    const parts = [];
    if (totalIn > 0) parts.push(`+${totalIn} palet`);
    if (totalOut > 0) parts.push(`-${totalOut} palet`);
    return parts.join(', ') || '';
  }

  if (action === 'MARK_DAY_COMPLETED') {
    return 'Brak ruchu w tym dniu';
  }

  return '';
}

// Filters state (local to this module)
let filters = {
  actionType: '',
  entityType: '',
  user: '',
  search: '',
};

/**
 * Audit Log Viewer — main view component.
 */
export function AuditLogViewer() {
  const allEntries = getAllAuditLog();

  // Apply filters
  let entries = allEntries;

  if (filters.actionType) {
    entries = entries.filter(e => e.action === filters.actionType);
  }
  if (filters.entityType) {
    entries = entries.filter(e => e.entityType === filters.entityType);
  }
  if (filters.user) {
    entries = entries.filter(e => e.userId === filters.user);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    entries = entries.filter(e => {
      const desc = describeEntityKey(e.entityType, e.entityKey).toLowerCase();
      const actionLabel = (ACTION_LABELS[e.action] || e.action).toLowerCase();
      return desc.includes(q) || actionLabel.includes(q) || e.userId.toLowerCase().includes(q);
    });
  }

  const container = el('div', { className: 'audit-viewer' });

  // Header
  container.appendChild(el('h2', { className: 'view-title' }, 'Audit Log'));

  // Stats bar
  const statsBar = el('div', { className: 'audit-stats' });
  statsBar.appendChild(el('span', { className: 'audit-stats__item' },
    `Wszystkich wpisow: ${allEntries.length}`));
  statsBar.appendChild(el('span', { className: 'audit-stats__item' },
    `Wyswietlanych: ${entries.length}`));
  container.appendChild(statsBar);

  // Filters bar
  const filtersBar = el('div', { className: 'settings-bar' });

  // Action type filter
  const actionSelect = el('select', {
    className: 'audit-filter-select',
    onChange: (e) => { filters.actionType = e.target.value; },
  });
  actionSelect.appendChild(el('option', { value: '' }, 'Wszystkie akcje'));
  const actionTypes = [...new Set(allEntries.map(e => e.action))].sort();
  for (const action of actionTypes) {
    const opt = el('option', { value: action }, ACTION_LABELS[action] || action);
    if (action === filters.actionType) opt.selected = true;
    actionSelect.appendChild(opt);
  }
  filtersBar.appendChild(el('label', {}, 'Akcja:'));
  filtersBar.appendChild(actionSelect);

  // Entity type filter
  const entitySelect = el('select', {
    className: 'audit-filter-select',
    onChange: (e) => { filters.entityType = e.target.value; },
  });
  entitySelect.appendChild(el('option', { value: '' }, 'Wszystkie typy'));
  const entityTypes = [...new Set(allEntries.map(e => e.entityType))].sort();
  for (const et of entityTypes) {
    const opt = el('option', { value: et }, ENTITY_LABELS[et] || et);
    if (et === filters.entityType) opt.selected = true;
    entitySelect.appendChild(opt);
  }
  filtersBar.appendChild(el('label', {}, 'Typ:'));
  filtersBar.appendChild(entitySelect);

  // User filter
  const userSelect = el('select', {
    className: 'audit-filter-select',
    onChange: (e) => { filters.user = e.target.value; },
  });
  userSelect.appendChild(el('option', { value: '' }, 'Wszyscy uzytkownicy'));
  const users = [...new Set(allEntries.map(e => e.userId))].sort((a, b) => a.localeCompare(b, 'pl'));
  for (const user of users) {
    const opt = el('option', { value: user }, user);
    if (user === filters.user) opt.selected = true;
    userSelect.appendChild(opt);
  }
  filtersBar.appendChild(el('label', {}, 'Uzytkownik:'));
  filtersBar.appendChild(userSelect);

  // Search input
  const searchInput = el('input', {
    type: 'text',
    className: 'audit-filter-search',
    placeholder: 'Szukaj...',
    value: filters.search,
    onInput: (e) => { filters.search = e.target.value; },
  });
  filtersBar.appendChild(searchInput);

  // Apply button
  const applyBtn = el('button', {
    className: 'btn-primary',
    onClick: () => { /* filters are already set via onChange — just trigger re-render */
      import('../store/actions.js').then(m => m.setActiveTab('audit'));
    },
  }, 'Filtruj');
  filtersBar.appendChild(applyBtn);

  // Reset button
  const resetBtn = el('button', {
    className: 'btn-secondary',
    onClick: () => {
      filters = { actionType: '', entityType: '', user: '', search: '' };
      import('../store/actions.js').then(m => m.setActiveTab('audit'));
    },
  }, 'Resetuj');
  filtersBar.appendChild(resetBtn);

  container.appendChild(filtersBar);

  // Table
  if (entries.length === 0) {
    const emptyMsg = el('div', { className: 'audit-empty' }, 'Brak wpisow spelniajacych kryteria.');
    container.appendChild(emptyMsg);
    return container;
  }

  const table = el('table', { className: 'data-table audit-table' });

  // Header
  const thead = el('thead');
  const headerRow = el('tr');
  const headers = ['Data i czas', 'Uzytkownik', 'Akcja', 'Typ', 'Obiekt', 'Szczegoly'];
  for (const h of headers) {
    headerRow.appendChild(el('th', {}, h));
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body
  const tbody = el('tbody');
  for (const entry of entries) {
    const row = el('tr');

    // Timestamp
    row.appendChild(el('td', { className: 'cell-number audit-table__timestamp' },
      formatTimestampPL(entry.timestamp)));

    // User
    row.appendChild(el('td', { className: 'audit-table__user' }, entry.userId));

    // Action badge
    const actionBadge = el('span', {
      className: `audit-badge ${getActionBadgeClass(entry.action)}`,
    }, ACTION_LABELS[entry.action] || entry.action);
    const actionTd = el('td');
    actionTd.appendChild(actionBadge);
    row.appendChild(actionTd);

    // Entity type
    row.appendChild(el('td', { className: 'audit-table__entity-type' },
      ENTITY_LABELS[entry.entityType] || entry.entityType));

    // Entity key (human-readable)
    row.appendChild(el('td', { className: 'audit-table__entity-key' },
      describeEntityKey(entry.entityType, entry.entityKey)));

    // Diff summary
    row.appendChild(el('td', { className: 'audit-table__diff' },
      describeDiff(entry.action, entry.diff)));

    tbody.appendChild(row);
  }

  table.appendChild(tbody);
  container.appendChild(table);

  return container;
}
