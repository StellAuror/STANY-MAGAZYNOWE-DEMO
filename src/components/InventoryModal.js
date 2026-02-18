import { el, clearElement } from '../utils/dom.js';
import {
  getModalState, getDailyRecord, getCurrentUser,
  getContractorById, getWarehouseById, getEnabledServices, getPalletTypes,
} from '../store/selectors.js';
import { closeModal } from '../store/actions.js';
import { saveInventory, sumEntries, getRecordHistory, calculateStockByPalletType } from '../services/inventoryService.js';
import { formatDatePL, formatTimestamp } from '../utils/date.js';
import { isValidQty, parseQty } from '../utils/validators.js';

/**
 * Modal for editing daily services.
 * Shows all enabled services for the contractor with qty + note fields.
 */
export function InventoryModal() {
  const modalState = getModalState();
  if (!modalState.open) return null;

  const { contractorId, warehouseId, date } = modalState;
  const contractor = getContractorById(contractorId);
  const warehouse = getWarehouseById(warehouseId);
  const record = getDailyRecord(contractorId, warehouseId, date);
  const userName = getCurrentUser();
  const enabledServices = getEnabledServices(contractorId);
  const palletTypes = getPalletTypes();

  // Local state: 
  // - For pallets: map of palletTypeId -> { qtyIn, qtyOut, noteIn, noteOut }
  // - For other services: map of serviceId -> { qty, note }
  const palletData = {};
  const servicesData = {};
  
  // Initialize pallet data
  const acceptedPalletTypes = contractor?.acceptedPalletTypes || [];
  acceptedPalletTypes.forEach(palletTypeId => {
    palletData[palletTypeId] = { qtyIn: 0, qtyOut: 0, noteIn: '', noteOut: '' };
  });
  
  // Load existing data
  if (record?.services) {
    record.services.forEach(s => {
      if (s.serviceId === 'svc-pallets-in' && s.palletEntries) {
        s.palletEntries.forEach(entry => {
          if (!palletData[entry.palletTypeId]) {
            palletData[entry.palletTypeId] = { qtyIn: 0, qtyOut: 0, noteIn: '', noteOut: '' };
          }
          palletData[entry.palletTypeId].qtyIn = entry.qty || 0;
          palletData[entry.palletTypeId].noteIn = entry.note || '';
        });
      } else if (s.serviceId === 'svc-pallets-out' && s.palletEntries) {
        s.palletEntries.forEach(entry => {
          if (!palletData[entry.palletTypeId]) {
            palletData[entry.palletTypeId] = { qtyIn: 0, qtyOut: 0, noteIn: '', noteOut: '' };
          }
          palletData[entry.palletTypeId].qtyOut = entry.qty || 0;
          palletData[entry.palletTypeId].noteOut = entry.note || '';
        });
      } else if (s.serviceId !== 'svc-pallets-in' && s.serviceId !== 'svc-pallets-out') {
        servicesData[s.serviceId] = { qty: s.qty || 0, note: s.note || '' };
      }
    });
  }
  
  // Ensure all enabled services (non-pallet) are in the map
  enabledServices.filter(svc => 
    svc.serviceId !== 'svc-pallets-in' && svc.serviceId !== 'svc-pallets-out'
  ).forEach(svc => {
    if (!servicesData[svc.serviceId]) {
      servicesData[svc.serviceId] = { qty: 0, note: '' };
    }
  });

  // Overlay
  const overlay = el('div', {
    className: 'modal-overlay',
    onClick: (e) => { if (e.target === overlay) closeModal(); },
  });

  const modal = el('div', { className: 'modal' });

  // Header
  const header = el('div', { className: 'modal__header' });
  header.appendChild(el('h2', {},
    `${contractor?.name || '?'} / ${warehouse?.name || '?'} / ${formatDatePL(date)}`
  ));
  header.appendChild(el('button', {
    className: 'modal__close',
    onClick: closeModal,
  }, '\u00D7'));
  modal.appendChild(header);

  // Body
  const body = el('div', { className: 'modal__body' });

  // Check if pallet services are enabled
  const palletInService = enabledServices.find(svc => svc.serviceId === 'svc-pallets-in');
  const palletOutService = enabledServices.find(svc => svc.serviceId === 'svc-pallets-out');
  const hasPalletServices = palletInService || palletOutService;

  // Calculate stock before today's entries
  const previousDate = new Date(date);
  previousDate.setDate(previousDate.getDate() - 1);
  const previousDateStr = previousDate.toISOString().slice(0, 10);
  const stockByType = calculateStockByPalletType(contractorId, warehouseId, previousDateStr);

  // PALETY section - combined entries and exits
  if (hasPalletServices) {
    const palletsSection = el('div', { className: 'section' });
    palletsSection.appendChild(el('div', { className: 'section__title' }, 'PALETY - WEJŚCIA I WYJŚCIA'));
    
    if (acceptedPalletTypes.length === 0) {
      const message = el('p', { 
        className: 'text-secondary', 
        style: { fontSize: '0.85rem', marginTop: '8px' } 
      }, 'Brak zdefiniowanych typów palet dla tego kontrahenta. Przejdź do zakładki "Kontrahent" i zaznacz akceptowane typy palet.');
      palletsSection.appendChild(message);
    } else {
      const palletsTable = el('div', { className: 'pallets-table' });
      
      // Header row
      const headerRow = el('div', { className: 'pallets-table__header' });
      headerRow.appendChild(el('div', { className: 'pallets-table__cell pallets-table__cell--label' }, 'Typ palety'));
      headerRow.appendChild(el('div', { className: 'pallets-table__cell pallets-table__cell--qty' }, 'Wejścia'));
      headerRow.appendChild(el('div', { className: 'pallets-table__cell pallets-table__cell--qty' }, 'Wyjścia'));
      headerRow.appendChild(el('div', { className: 'pallets-table__cell pallets-table__cell--qty' }, 'Różnica'));
      headerRow.appendChild(el('div', { className: 'pallets-table__cell pallets-table__cell--qty' }, 'Stan'));
      palletsTable.appendChild(headerRow);
      
      // Data rows
      acceptedPalletTypes.forEach(palletTypeId => {
        const palletType = palletTypes.find(pt => pt.id === palletTypeId);
        if (!palletType) return;
        
        const data = palletData[palletTypeId];
        const previousStock = stockByType.get(palletTypeId) || 0;
        
        const row = el('div', { className: 'pallets-table__row' });
        
        // Label
        const labelCell = el('div', { className: 'pallets-table__cell pallets-table__cell--label' });
        labelCell.appendChild(el('span', { className: 'service-entry-label' }, palletType.name));
        if (palletType.dimensions) {
          labelCell.appendChild(el('span', { 
            className: 'service-entry-label__detail',
            style: { fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginLeft: '8px' }
          }, palletType.dimensions));
        }
        row.appendChild(labelCell);
        
        // Wejścia input
        const inCell = el('div', { className: 'pallets-table__cell pallets-table__cell--qty' });
        const inInput = el('input', {
          type: 'number',
          min: '0',
          step: '1',
          value: String(data.qtyIn),
          className: 'pallets-table__input',
          onInput: (e) => {
            palletData[palletTypeId].qtyIn = parseQty(e.target.value) ?? 0;
            // Update difference and stock
            updatePalletRow(palletTypeId);
          },
        });
        inCell.appendChild(inInput);
        row.appendChild(inCell);
        
        // Wyjścia input
        const outCell = el('div', { className: 'pallets-table__cell pallets-table__cell--qty' });
        const outInput = el('input', {
          type: 'number',
          min: '0',
          step: '1',
          value: String(data.qtyOut),
          className: 'pallets-table__input',
          onInput: (e) => {
            palletData[palletTypeId].qtyOut = parseQty(e.target.value) ?? 0;
            // Update difference and stock
            updatePalletRow(palletTypeId);
          },
        });
        outCell.appendChild(outInput);
        row.appendChild(outCell);
        
        // Różnica (calculated)
        const diffCell = el('div', { className: 'pallets-table__cell pallets-table__cell--qty' });
        const diff = data.qtyIn - data.qtyOut;
        const diffDisplay = el('span', { 
          className: 'pallets-table__value',
          style: { 
            fontWeight: '600',
            color: diff > 0 ? '#059669' : diff < 0 ? '#dc2626' : 'var(--color-text-secondary)'
          },
          dataset: { palletTypeId, displayType: 'diff' }
        }, diff > 0 ? `+${diff}` : String(diff));
        diffCell.appendChild(diffDisplay);
        row.appendChild(diffCell);
        
        // Stan (calculated)
        const stockCell = el('div', { className: 'pallets-table__cell pallets-table__cell--qty' });
        const newStock = previousStock + diff;
        const stockDisplay = el('span', { 
          className: 'pallets-table__value',
          style: { fontWeight: '600', fontFamily: 'var(--font-mono)' },
          dataset: { palletTypeId, displayType: 'stock' }
        }, String(newStock));
        stockCell.appendChild(stockDisplay);
        row.appendChild(stockCell);
        
        palletsTable.appendChild(row);
      });
      
      palletsSection.appendChild(palletsTable);
      
      // Helper function to update calculated cells
      function updatePalletRow(palletTypeId) {
        const data = palletData[palletTypeId];
        const diff = data.qtyIn - data.qtyOut;
        const previousStock = stockByType.get(palletTypeId) || 0;
        const newStock = previousStock + diff;
        
        // Find and update diff display
        const diffDisplay = palletsTable.querySelector(`[data-pallet-type-id="${palletTypeId}"][data-display-type="diff"]`);
        if (diffDisplay) {
          diffDisplay.textContent = diff > 0 ? `+${diff}` : String(diff);
          diffDisplay.style.color = diff > 0 ? '#059669' : diff < 0 ? '#dc2626' : 'var(--color-text-secondary)';
        }
        
        // Find and update stock display
        const stockDisplay = palletsTable.querySelector(`[data-pallet-type-id="${palletTypeId}"][data-display-type="stock"]`);
        if (stockDisplay) {
          stockDisplay.textContent = String(newStock);
        }
      }
    }
    
    body.appendChild(palletsSection);
  }

  // Other services section — split into TRANSPORT and VASY
  const otherServices = enabledServices.filter(svc =>
    svc.serviceId !== 'svc-pallets-in' && svc.serviceId !== 'svc-pallets-out'
  );

  const isTransport = (svc) => /transport/i.test(svc.definition.name);

  const buildServiceRows = (services, container) => {
    services.forEach(svc => {
      const serviceRow = el('div', { className: 'service-entry-row' });

      const nameLabel = el('label', { className: 'service-entry-label' }, svc.definition.name);
      serviceRow.appendChild(nameLabel);

      const qtyInput = el('input', {
        type: 'number',
        min: '0',
        step: '1',
        value: String(servicesData[svc.serviceId].qty),
        placeholder: 'Ilość',
        className: 'service-entry-input',
        onInput: (e) => { servicesData[svc.serviceId].qty = parseQty(e.target.value) ?? 0; },
      });
      serviceRow.appendChild(qtyInput);

      const noteInput = el('input', {
        type: 'text',
        value: servicesData[svc.serviceId].note,
        placeholder: 'Notatka (opcjonalnie)',
        className: 'service-entry-input',
        onInput: (e) => { servicesData[svc.serviceId].note = e.target.value; },
      });
      serviceRow.appendChild(noteInput);

      container.appendChild(serviceRow);
    });
  };

  const transportServices = otherServices.filter(isTransport);
  const vasyServices = otherServices.filter(svc => !isTransport(svc));

  if (transportServices.length > 0) {
    const transportSection = el('div', { className: 'section' });
    const transportTitle = el('div', { className: 'section__title' });
    transportTitle.textContent = 'TRANSPORT';
    transportTitle.style.color = '#2563eb';
    transportSection.appendChild(transportTitle);
    const transportContainer = el('div', { className: 'services-grid' });
    buildServiceRows(transportServices, transportContainer);
    transportSection.appendChild(transportContainer);
    body.appendChild(transportSection);
  }

  if (vasyServices.length > 0) {
    const vasySection = el('div', { className: 'section' });
    const vasyTitle = el('div', { className: 'section__title' });
    vasyTitle.textContent = 'VASY';
    vasyTitle.style.color = '#7c3aed';
    vasySection.appendChild(vasyTitle);
    const vasyContainer = el('div', { className: 'services-grid' });
    buildServiceRows(vasyServices, vasyContainer);
    vasySection.appendChild(vasyContainer);
    body.appendChild(vasySection);
  }

  // -- History section --
  const historySection = el('div', { className: 'section' });
  historySection.appendChild(el('div', { className: 'section__title' }, 'Historia dla tej daty'));

  const auditEntries = getRecordHistory(contractorId, warehouseId, date);

  if (auditEntries.length === 0) {
    historySection.appendChild(el('p', { className: 'text-secondary', style: { fontSize: '0.85rem' } },
      'Brak wcześniejszych wpisów.'));
  } else {
    const auditList = el('ul', { className: 'audit-list' });
    for (const entry of auditEntries) {
      const li = el('li');
      li.appendChild(el('span', { className: 'audit-list__time' }, formatTimestamp(entry.timestamp)));
      li.appendChild(el('span', { className: 'audit-list__user' }, entry.userId || 'System'));
      li.appendChild(el('span', { className: 'audit-list__diff' }, `Akcja: ${entry.action}`));

      if (entry.diff) {
        const diffText = formatDiff(entry.diff);
        if (diffText) {
          li.appendChild(el('span', { className: 'audit-list__diff' }, diffText));
        }
      }

      auditList.appendChild(li);
    }
    historySection.appendChild(auditList);
  }

  body.appendChild(historySection);
  modal.appendChild(body);

  // Footer
  const footer = el('div', { className: 'modal__footer' });
  footer.appendChild(el('button', {
    className: 'btn-secondary',
    onClick: closeModal,
  }, 'Anuluj'));
  footer.appendChild(el('button', {
    className: 'btn-primary',
    onClick: async () => {
      // Convert data to services array format
      const services = [];
      
      // Add pallet entries - split into svc-pallets-in and svc-pallets-out
      if (hasPalletServices) {
        const entriesIn = [];
        const entriesOut = [];
        
        for (const [palletTypeId, data] of Object.entries(palletData)) {
          if (data.qtyIn > 0 || data.noteIn) {
            entriesIn.push({
              palletTypeId,
              qty: data.qtyIn,
              note: data.noteIn
            });
          }
          if (data.qtyOut > 0 || data.noteOut) {
            entriesOut.push({
              palletTypeId,
              qty: data.qtyOut,
              note: data.noteOut
            });
          }
        }
        
        if (palletInService && entriesIn.length > 0) {
          services.push({
            serviceId: 'svc-pallets-in',
            palletEntries: entriesIn,
          });
        }
        
        if (palletOutService && entriesOut.length > 0) {
          services.push({
            serviceId: 'svc-pallets-out',
            palletEntries: entriesOut,
          });
        }
      }
      
      // Add other services
      for (const [serviceId, data] of Object.entries(servicesData)) {
        if (data.qty > 0 || (data.note && data.note.trim())) {
          services.push({
            serviceId,
            qty: data.qty,
            note: data.note
          });
        }
      }

      // Always allow saving
      await saveInventory(contractorId, warehouseId, date, services, userName);
      closeModal();
    },
  }, 'Zapisz'));
  modal.appendChild(footer);

  overlay.appendChild(modal);
  return overlay;
}

function formatDiff(diff) {
  const parts = [];
  if (diff.entriesBefore && diff.entriesAfter) {
    const before = diff.entriesBefore.map(e => e.qty).join(', ') || 'brak';
    const after = diff.entriesAfter.map(e => e.qty).join(', ') || 'brak';
    if (before !== after) parts.push(`Wejścia: [${before}] → [${after}]`);
  }
  if (diff.exitsBefore && diff.exitsAfter) {
    const before = diff.exitsBefore.map(e => e.qty).join(', ') || 'brak';
    const after = diff.exitsAfter.map(e => e.qty).join(', ') || 'brak';
    if (before !== after) parts.push(`Wyjścia: [${before}] → [${after}]`);
  }
  if (diff.effectiveFrom) parts.push(`Od: ${diff.effectiveFrom}`);
  if (diff.pricePerUnit !== undefined) parts.push(`Stawka: ${diff.pricePerUnit}`);
  if (diff.before && diff.after) {
    parts.push(`Przed: ${JSON.stringify(diff.before)} → Po: ${JSON.stringify(diff.after)}`);
  }
  return parts.join(' | ');
}
