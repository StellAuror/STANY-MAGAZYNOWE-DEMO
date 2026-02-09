import { el } from '../utils/dom.js';
import { getState } from '../store/store.js';
import { addPalletType, updatePalletType, deletePalletType } from '../store/actions.js';

/**
 * Component for managing pallet types (rodzaje palet).
 */
export function PalletTypesManager() {
  const { palletTypes } = getState();

  const container = el('div', { className: 'view-container' });

  // Header
  const header = el('div', { className: 'view-header flex items-center justify-between' });
  header.appendChild(el('h2', {}, 'Rodzaje palet'));
  
  const addButton = el('button', {
    className: 'btn btn-primary',
    onClick: () => handleAdd(),
  }, '+ Dodaj rodzaj palety');
  header.appendChild(addButton);
  
  container.appendChild(header);

  // Table
  const table = el('table', { className: 'data-table' });

  // Header
  const thead = el('thead');
  const headerRow = el('tr');
  headerRow.appendChild(el('th', {}, 'Nazwa'));
  headerRow.appendChild(el('th', {}, 'Wymiary'));
  headerRow.appendChild(el('th', {}, 'Max. obciążenie'));
  headerRow.appendChild(el('th', {}, 'Uwagi'));
  headerRow.appendChild(el('th', { className: 'text-center' }, 'Info'));
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body
  const tbody = el('tbody');

  if (palletTypes.length === 0) {
    const emptyRow = el('tr');
    emptyRow.appendChild(el('td', { colspan: '5', className: 'text-center text-secondary', style: { padding: '24px' } },
      'Brak rodzajów palet. Kliknij "+ Dodaj rodzaj palety", aby dodać.'));
    tbody.appendChild(emptyRow);
  } else {
    palletTypes.forEach(pallet => {
      const row = el('tr');

      row.appendChild(el('td', { className: 'font-semibold' }, pallet.name));
      row.appendChild(el('td', {}, pallet.dimensions || '-'));
      row.appendChild(el('td', {}, pallet.maxLoad || '-'));
      row.appendChild(el('td', {}, pallet.notes || '-'));

      // Actions - disabled (editing locked outside contractor view)
      const actionsCell = el('td', { className: 'text-center text-secondary', style: { fontSize: '0.85rem' } });
      actionsCell.textContent = 'Edycja zablokowana';
      row.appendChild(actionsCell);

      tbody.appendChild(row);
    });
  }

  table.appendChild(tbody);
  container.appendChild(table);

  return container;
}

function handleAdd() {
  const name = prompt('Nazwa rodzaju palety:');
  if (!name) return;

  const dimensions = prompt('Wymiary (np. 1200x800x144 mm):');
  const maxLoad = prompt('Maksymalne obciążenie (np. 1500 kg):');
  const notes = prompt('Uwagi (opcjonalnie):');

  addPalletType({
    name,
    dimensions: dimensions || '',
    maxLoad: maxLoad || '',
    notes: notes || '',
  });
}

function handleEdit(pallet) {
  const name = prompt('Nazwa rodzaju palety:', pallet.name);
  if (!name) return;

  const dimensions = prompt('Wymiary:', pallet.dimensions);
  const maxLoad = prompt('Maksymalne obciążenie:', pallet.maxLoad);
  const notes = prompt('Uwagi:', pallet.notes);

  updatePalletType(pallet.id, {
    name,
    dimensions: dimensions || '',
    maxLoad: maxLoad || '',
    notes: notes || '',
  });
}

function handleDelete(pallet) {
  if (!confirm(`Czy na pewno chcesz usunąć rodzaj palety "${pallet.name}"?`)) return;
  deletePalletType(pallet.id);
}
