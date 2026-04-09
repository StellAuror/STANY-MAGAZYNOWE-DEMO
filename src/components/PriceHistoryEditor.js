import { el, clearElement, showPrompt, showAlert } from '../utils/dom.js';
import {
  getPriceEditorState, getServicePrices, getCurrentUser,
  getContractorById, getServiceDefinitionById,
} from '../store/selectors.js';
import { closePriceEditor } from '../store/actions.js';
import { pricingService } from '../services/pricingService.js';
import { formatDatePL, today } from '../utils/date.js';
import { formatUnit } from '../utils/format.js';
import { parsePrice, isValidDate, normalizeCurrency, isValidCurrency } from '../utils/validators.js';

/**
 * Modal for editing price history of a service for a contractor.
 */
export function PriceHistoryEditor() {
  const editorState = getPriceEditorState();
  if (!editorState.open) return null;

  const { contractorId, serviceId } = editorState;
  const contractor = getContractorById(contractorId);
  const serviceDef = getServiceDefinitionById(serviceId);
  const userName = getCurrentUser();
  const prices = getServicePrices(contractorId, serviceId);

  // Overlay
  const overlay = el('div', {
    className: 'modal-overlay',
    onClick: (e) => { if (e.target === overlay) closePriceEditor(); },
  });

  const modal = el('div', { className: 'modal' });

  // Header
  const header = el('div', { className: 'modal__header' });
  header.appendChild(el('h2', {},
    `Cennik: ${contractor?.name || '?'} — ${serviceDef?.name || '?'}`
  ));
  header.appendChild(el('button', {
    className: 'modal__close',
    onClick: closePriceEditor,
  }, '\u00D7'));
  modal.appendChild(header);

  // Body
  const body = el('div', { className: 'modal__body' });

  // Existing prices
  const historySection = el('div', { className: 'section' });
  historySection.appendChild(el('div', { className: 'section__title' },
    `Historia stawek (${formatUnit(serviceDef?.unit || '')})`));

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
        `${p.pricePerUnit.toFixed(2)} ${p.currency || 'PLN'}`));

      // Edit button
      const editBtn = el('button', {
        className: 'btn-secondary btn-small',
        onClick: async () => {
          const newPrice = await showPrompt(`Nowa stawka (aktualna: ${p.pricePerUnit.toFixed(2)}):`, String(p.pricePerUnit.toFixed(2)));
          if (newPrice === null) return;

          const parsed = parsePrice(newPrice);
          if (parsed === null) {
            await showAlert('Nieprawidłowa wartość. Wprowadź liczbę >= 0.');
            return;
          }

          const newCurrencyRaw = await showPrompt(
            `Waluta (aktualna: ${p.currency || 'PLN'}):`,
            p.currency || 'PLN'
          );
          if (newCurrencyRaw === null) return;

          const currency = normalizeCurrency(newCurrencyRaw);
          if (!isValidCurrency(currency)) {
            await showAlert('Nieprawidłowa waluta. Użyj 3-5 liter (A-Z), np. PLN lub EUR.');
            return;
          }

          await pricingService.updatePrice(p.id, {
            contractorId,
            serviceId,
            pricePerUnit: parsed,
            currency,
          }, userName);
          closePriceEditor();
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

  addForm.appendChild(el('label', { style: { fontSize: '0.85rem' } }, 'Waluta:'));
  const currencyInput = el('input', {
    type: 'text',
    value: 'PLN',
    maxLength: 5,
    placeholder: 'PLN',
    style: { width: '80px', textTransform: 'uppercase' },
    onInput: (e) => {
      e.target.value = normalizeCurrency(e.target.value);
    },
  });
  addForm.appendChild(currencyInput);
  addForm.appendChild(el('span', { className: 'text-secondary', style: { fontSize: '0.85rem' } },
    `/${formatUnit(serviceDef?.unit || '')}`));

  const addBtn = el('button', {
    className: 'btn-primary btn-small',
    onClick: async () => {
      const effectiveFrom = dateInput.value;
      const priceVal = priceInput.value;
      const currency = normalizeCurrency(currencyInput.value);

      if (!isValidDate(effectiveFrom)) {
        await showAlert('Wprowadź prawidłową datę.');
        return;
      }

      const parsed = parsePrice(priceVal);
      if (parsed === null) {
        await showAlert('Wprowadź prawidłową stawkę (liczba >= 0).');
        return;
      }

      if (!isValidCurrency(currency)) {
        await showAlert('Wprowadź prawidłową walutę (3-5 liter, np. PLN).');
        return;
      }

      await pricingService.addPrice(contractorId, serviceId, effectiveFrom, parsed, currency, userName);
      closePriceEditor();
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
    onClick: closePriceEditor,
  }, 'Zamknij'));
  modal.appendChild(footer);

  overlay.appendChild(modal);
  return overlay;
}
