import { el } from '../utils/dom.js';
import { getState } from '../store/store.js';
import { addWarehouse, updateWarehouse, deleteWarehouse } from '../store/actions.js';

/**
 * Component for managing warehouses (Magazyny).
 * Allows adding, renaming and deleting warehouses.
 */
export function WarehousesManager() {
  const { warehouses } = getState();
  const sorted = [...warehouses].sort((a, b) => a.sortOrder - b.sortOrder);

  const container = el('div', { className: 'view-container' });

  // Header
  const header = el('div', { className: 'view-header flex items-center justify-between' });
  header.appendChild(el('h2', {}, 'Magazyny'));

  const addButton = el('button', {
    className: 'btn btn-primary',
    onClick: () => handleAdd(),
  }, '+ Dodaj magazyn');
  header.appendChild(addButton);

  container.appendChild(header);

  // Info note
  const note = el('p', { className: 'view-note' },
    'Magazyny są widoczne w przełączniku w górnym pasku aplikacji. ' +
    'Możesz dowolnie dodawać, zmieniać nazwy i usuwać magazyny.'
  );
  container.appendChild(note);

  // Table
  const table = el('table', { className: 'data-table' });

  const thead = el('thead');
  const headerRow = el('tr');
  headerRow.appendChild(el('th', { style: { width: '48px' } }, 'Lp.'));
  headerRow.appendChild(el('th', {}, 'Nazwa magazynu'));
  headerRow.appendChild(el('th', { className: 'text-right', style: { width: '220px' } }, 'Akcje'));
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = el('tbody');

  if (sorted.length === 0) {
    const emptyRow = el('tr');
    emptyRow.appendChild(el('td', {
      colspan: '3',
      className: 'text-center text-secondary',
      style: { padding: '24px' },
    }, 'Brak magazynów. Kliknij "+ Dodaj magazyn", aby dodać pierwszy.'));
    tbody.appendChild(emptyRow);
  } else {
    sorted.forEach((wh, idx) => {
      const row = el('tr', { className: 'warehouse-row' });

      row.appendChild(el('td', { className: 'text-secondary', style: { width: '48px' } }, String(idx + 1)));

      // Inline editable name cell
      const nameCell = el('td', {});
      const nameText = el('span', { className: 'warehouse-name-text font-semibold' }, wh.name);
      nameCell.appendChild(nameText);
      row.appendChild(nameCell);

      // Actions cell
      const actionsCell = el('td', { style: { width: '220px' } });
      const actionsWrap = el('div', { className: 'warehouse-actions' });

      const editBtn = el('button', {
        className: 'btn btn-sm btn-secondary',
        onClick: () => handleEdit(wh),
      }, 'Zmień nazwę');

      const deleteBtn = el('button', {
        className: 'btn btn-sm btn-danger',
        onClick: () => handleDelete(wh),
        title: 'Usuń magazyn',
      }, 'Usuń');

      // Disable delete if this is the last warehouse
      if (sorted.length === 1) {
        deleteBtn.disabled = true;
        deleteBtn.title = 'Nie można usunąć ostatniego magazynu';
      }

      actionsWrap.appendChild(editBtn);
      actionsWrap.appendChild(deleteBtn);
      actionsCell.appendChild(actionsWrap);
      row.appendChild(actionsCell);

      tbody.appendChild(row);
    });
  }

  table.appendChild(tbody);
  container.appendChild(table);

  return container;
}

async function handleAdd() {
  const name = prompt('Nazwa nowego magazynu:');
  if (!name || !name.trim()) return;
  await addWarehouse(name.trim());
}

async function handleEdit(wh) {
  const name = prompt('Nowa nazwa magazynu:', wh.name);
  if (!name || !name.trim()) return;
  if (name.trim() === wh.name) return;
  await updateWarehouse(wh.id, { name: name.trim() });
}

async function handleDelete(wh) {
  const confirmed = confirm(
    `Czy na pewno chcesz usunąć magazyn „${wh.name}"?\n\n` +
    'Uwaga: usunięcie magazynu nie usuwa powiązanych wpisów stanów magazynowych.'
  );
  if (!confirmed) return;
  await deleteWarehouse(wh.id);
}
