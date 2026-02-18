import { el, showMultiPrompt, showConfirm } from '../utils/dom.js';
import { getState } from '../store/store.js';
import { addPalletType, updatePalletType, deletePalletType } from '../store/actions.js';

/**
 * Component for managing pallet types (rodzaje palet).
 */
export function PalletTypesManager() {
  const { palletTypes } = getState();

  const container = el('div', { className: 'view-container view-container--full' });

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

async function handleAdd() {
  const result = await showMultiPrompt('Nowy rodzaj palety', [
    { label: 'Nazwa', key: 'name', required: true, placeholder: 'np. Europaleta' },
    { label: 'Wymiary', key: 'dimensions', placeholder: 'np. 1200x800x144 mm' },
    { label: 'Maksymalne obciążenie', key: 'maxLoad', placeholder: 'np. 1500 kg' },
    { label: 'Uwagi (opcjonalnie)', key: 'notes', placeholder: '' },
  ]);
  if (!result) return;

  addPalletType({
    name: result.name,
    dimensions: result.dimensions || '',
    maxLoad: result.maxLoad || '',
    notes: result.notes || '',
  });
}

async function handleEdit(pallet) {
  const result = await showMultiPrompt('Edytuj rodzaj palety', [
    { label: 'Nazwa', key: 'name', required: true, defaultValue: pallet.name },
    { label: 'Wymiary', key: 'dimensions', defaultValue: pallet.dimensions || '' },
    { label: 'Maksymalne obciążenie', key: 'maxLoad', defaultValue: pallet.maxLoad || '' },
    { label: 'Uwagi', key: 'notes', defaultValue: pallet.notes || '' },
  ]);
  if (!result) return;

  updatePalletType(pallet.id, {
    name: result.name,
    dimensions: result.dimensions || '',
    maxLoad: result.maxLoad || '',
    notes: result.notes || '',
  });
}

async function handleDelete(pallet) {
  const confirmed = await showConfirm(`Czy na pewno chcesz usunąć rodzaj palety „${pallet.name}"?`);
  if (!confirmed) return;
  deletePalletType(pallet.id);
}
