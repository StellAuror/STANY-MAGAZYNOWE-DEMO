import { el, clearElement, showPrompt, showAlert } from '../utils/dom.js';
import {
  getPalletPrices, getCurrentUser,
  getContractorById, getPalletTypes, getPalletPriceEditorState,
} from '../store/selectors.js';
import { closePalletPriceEditor } from '../store/actions.js';
import { pricingService } from '../services/pricingService.js';
import { formatDatePL, today } from '../utils/date.js';
import { isValidPrice, parsePrice, isValidDate } from '../utils/validators.js';

/**
 * Modal for editing pallet price history for a contractor and pallet type.
 */
export function PalletPriceEditor() {
  const editorState = getPalletPriceEditorState();
  if (!editorState.open) return null;

  const { contractorId, palletTypeId, direction } = editorState;
  const contractor = getContractorById(contractorId);
  const palletTypes = getPalletTypes();
  const palletType = palletTypes.find(pt => pt.id === palletTypeId);
  const userName = getCurrentUser();
  const prices = getPalletPrices(contractorId, palletTypeId, direction);

  const directionLabel = direction === 'in' ? 'RUCHY (wejścia + wyjścia)' : 'MAGAZYNOWANIE';
  const directionColor = direction === 'in' ? '#059669' : '#7c3aed';

  // Overlay
  const overlay = el('div', {
    className: 'modal-overlay',
    onClick: (e) => { if (e.target === overlay) closePalletPriceEditor(); },
  });

  const modal = el('div', { className: 'modal' });

  // Header
  const header = el('div', { className: 'modal__header' });
  header.appendChild(el('h2', {},
    `Cennik palet: ${contractor?.name || '?'} — ${palletType?.name || '?'}`
  ));
  const directionBadge = el('span', {
    style: {
      marginLeft: '12px',
      padding: '4px 12px',
      borderRadius: '12px',
      fontSize: '0.85rem',
      fontWeight: '600',
      background: directionColor,
      color: 'white',
    },
  }, directionLabel);
  header.appendChild(directionBadge);
  
  header.appendChild(el('button', {
    className: 'modal__close',
    onClick: closePalletPriceEditor,
  }, '\u00D7'));
  modal.appendChild(header);

  // Body
  const body = el('div', { className: 'modal__body' });

  // Existing prices
  const historySection = el('div', { className: 'section' });
  historySection.appendChild(el('div', { className: 'section__title' },
    `Historia stawek (zł/szt)`));

  if (prices.length === 0) {
    historySection.appendChild(el('p', { className: 'text-secondary' },
      'Brak zdefiniowanych stawek.'));
  } else {
    const priceList = el('div', { className: 'price-history' });
    for (const p of prices) {
      const row = el('div', { className: 'price-history__row' });
      row.appendChild(el('span', { className: 'price-history__date' },
        `Od ${formatDatePL(p.effectiveFrom)}`));
      row.appendChild(el('span', { className: 'price-history__price' },
        `${p.pricePerUnit.toFixed(2)} zł`));

      // Edit button
      const editBtn = el('button', {
        className: 'btn-secondary btn-small',
        onClick: async () => {
          const newPrice = await showPrompt(`Nowa stawka (aktualna: ${p.pricePerUnit.toFixed(2)}):`, String(p.pricePerUnit.toFixed(2)));
          if (newPrice !== null) {
            const parsed = parsePrice(newPrice);
            if (parsed !== null) {
              await pricingService.updatePalletPrice(p.id, {
                contractorId,
                palletTypeId,
                direction,
                pricePerUnit: parsed,
              }, userName);
              closePalletPriceEditor();
            } else {
              await showAlert('Nieprawidłowa wartość. Wprowadź liczbę >= 0.');
            }
          }
        },
      }, 'Edytuj');
      row.appendChild(editBtn);

      priceList.appendChild(row);
    }
    historySection.appendChild(priceList);
  }

  body.appendChild(historySection);

  // Add new price
  const addSection = el('div', { className: 'section' });
  addSection.appendChild(el('div', { className: 'section__title' }, 'Dodaj nową stawkę'));

  const addForm = el('div', { className: 'flex gap-sm items-center', style: { flexWrap: 'wrap' } });

  addForm.appendChild(el('label', { style: { fontSize: '0.85rem' } }, 'Od daty:'));
  const dateInput = el('input', {
    type: 'date',
    value: today(),
  });
  addForm.appendChild(dateInput);

  addForm.appendChild(el('label', { style: { fontSize: '0.85rem' } }, 'Stawka:'));
  const priceInput = el('input', {
    type: 'number',
    min: '0',
    step: '0.01',
    placeholder: '0.00',
    style: { width: '100px' },
  });
  addForm.appendChild(priceInput);
  addForm.appendChild(el('span', { className: 'text-secondary', style: { fontSize: '0.85rem' } },
    `zł/szt`));

  const addBtn = el('button', {
    className: 'btn-primary btn-small',
    onClick: async () => {
      const effectiveFrom = dateInput.value;
      const priceVal = priceInput.value;

      if (!isValidDate(effectiveFrom)) {
        await showAlert('Wprowadź prawidłową datę.');
        return;
      }

      const parsed = parsePrice(priceVal);
      if (parsed === null) {
        await showAlert('Wprowadź prawidłową stawkę (liczba >= 0).');
        return;
      }

      await pricingService.addPalletPrice(contractorId, palletTypeId, direction, effectiveFrom, parsed, userName);
      closePalletPriceEditor();
    },
  }, 'Dodaj');
  addForm.appendChild(addBtn);

  addSection.appendChild(addForm);
  body.appendChild(addSection);

  modal.appendChild(body);

  // Footer
  const footer = el('div', { className: 'modal__footer' });
  footer.appendChild(el('button', {
    className: 'btn-secondary',
    onClick: closePalletPriceEditor,
  }, 'Zamknij'));
  modal.appendChild(footer);

  overlay.appendChild(modal);
  return overlay;
}
