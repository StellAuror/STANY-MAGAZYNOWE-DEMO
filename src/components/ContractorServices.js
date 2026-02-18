import { el, showPrompt, showMultiPrompt, showConfirm } from '../utils/dom.js';
import {
  getContractors, getServiceDefinitions, getContractorServices,
  getServicePrices, getContractorById, getPalletTypes, getPalletPrices,
} from '../store/selectors.js';
import { toggleContractorService, openPriceEditor, openPalletPriceEditor, setSelectedContractor, addServiceDefinition, addContractor, removeContractorService, enableServiceForContractor, updateContractor } from '../store/actions.js';
import { getState } from '../store/store.js';
import { formatUnit } from '../utils/format.js';
import { formatDatePL } from '../utils/date.js';

/**
 * View 2: Contractor services management.
 * Allows selecting a contractor, toggling services, viewing price history.
 * Can add custom services.
 */
export function ContractorServices() {
  const contractors = getContractors();
  const serviceDefs = getServiceDefinitions();
  const state = getState();
  const selectedId = state.selectedContractorId;

  const wrapper = el('div');

  // Contractor selector
  const selectorDiv = el('div', { className: 'contractor-selector settings-bar' });
  selectorDiv.appendChild(el('label', {}, 'Kontrahent:'));

  const select = el('select', {
    onChange: (e) => setSelectedContractor(e.target.value || null),
  });
  select.appendChild(el('option', { value: '' }, '-- Wybierz kontrahenta --'));
  for (const c of contractors) {
    const opt = el('option', { value: c.id }, c.name);
    if (c.id === selectedId) opt.selected = true;
    select.appendChild(opt);
  }
  selectorDiv.appendChild(select);
  
  // Add Contractor button
  const addContractorBtn = el('button', {
    className: 'btn-primary btn-small',
    onClick: async () => {
      const name = await showPrompt('Nazwa nowego kontrahenta:');
      if (name && name.trim()) {
        addContractor(name.trim());
      }
    },
  }, '+ Kontrahent');
  selectorDiv.appendChild(addContractorBtn);

  // Add Custom Service button
  const addServiceBtn = el('button', {
    className: 'btn-secondary btn-small',
    onClick: async () => {
      const result = await showMultiPrompt('Nowa usługa', [
        { label: 'Nazwa usługi', key: 'name', required: true, placeholder: 'np. Transport' },
        { label: 'Jednostka miary', key: 'unit', defaultValue: 'PIECE', placeholder: 'PALLET, KM, HOUR, PIECE' },
        { label: 'Opis (opcjonalnie)', key: 'description', placeholder: 'Krótki opis...' },
      ]);
      if (!result) return;

      const newService = await addServiceDefinition(
        result.name.trim(),
        result.unit.trim().toUpperCase(),
        (result.description || '').trim()
      );

      // Auto-enable for current contractor if one is selected
      if (selectedId && newService) {
        await enableServiceForContractor(selectedId, newService.id);
      }
    },
  }, '+ Dodaj usługę');
  selectorDiv.appendChild(addServiceBtn);
  
  wrapper.appendChild(selectorDiv);

  if (!selectedId) {
    wrapper.appendChild(el('p', { className: 'text-secondary text-center mt-lg' },
      'Wybierz kontrahenta, aby zarządzać usługami i cennikiem.'));
    return wrapper;
  }

  const contractor = getContractorById(selectedId);
  if (!contractor) return wrapper;

  // Helper: build a service-list block for a given set of service definitions
  const buildServiceList = (defs) => {
    const list = el('div', {
      className: 'service-list',
      style: { background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' },
    });

    for (const def of defs) {
      const prices = getServicePrices(selectedId, def.id);

      const item = el('div', { className: 'service-list__item', style: { flexDirection: 'column', alignItems: 'stretch', gap: '10px' } });

      // Top row: name + unit + buttons
      const topRow = el('div', { className: 'flex items-center justify-between' });

      const nameContainer = el('div', { className: 'flex items-center gap-sm' });
      nameContainer.appendChild(el('span', { className: 'service-list__name' }, def.name));
      nameContainer.appendChild(el('span', { className: 'service-list__unit' }, formatUnit(def.unit)));
      topRow.appendChild(nameContainer);

      const buttonGroup = el('div', { className: 'flex gap-sm' });

      const priceBtn = el('button', {
        className: 'btn-secondary btn-small',
        onClick: () => openPriceEditor(selectedId, def.id),
      }, 'Cennik');
      buttonGroup.appendChild(priceBtn);

      if (!['svc-pallets-in', 'svc-pallets-out'].includes(def.id)) {
        const deleteBtn = el('button', {
          className: 'btn-danger btn-small',
          onClick: async () => {
            const confirmed = await showConfirm(`Czy na pewno usunąć usługę „${def.name}" dla tego kontrahenta?`);
            if (confirmed) {
              await removeContractorService(selectedId, def.id);
            }
          },
        }, 'Usuń');
        buttonGroup.appendChild(deleteBtn);
      }

      topRow.appendChild(buttonGroup);
      item.appendChild(topRow);

      if (prices.length > 0) {
        const priceHistory = el('div', { className: 'price-history' });
        for (const p of prices) {
          const row = el('div', { className: 'price-history__row' });
          row.appendChild(el('span', { className: 'price-history__date' }, `Od ${formatDatePL(p.effectiveFrom)}`));
          row.appendChild(el('span', { className: 'price-history__price' }, `${p.pricePerUnit.toFixed(2)} zł/${formatUnit(def.unit)}`));
          priceHistory.appendChild(row);
        }
        item.appendChild(priceHistory);
      } else {
        item.appendChild(el('p', {
          className: 'text-secondary',
          style: { fontSize: '0.8rem', marginLeft: '26px' },
        }, 'Brak zdefiniowanych stawek. Kliknij "Cennik", aby dodać.'));
      }

      list.appendChild(item);
    }

    return list;
  };

  // Split enabled services into Transport and VASY
  const enabledDefs = serviceDefs.filter(def => {
    const cs = state.contractorServices.find(
      cs => cs.contractorId === selectedId && cs.serviceId === def.id
    );
    return cs?.isEnabled || false;
  });

  const transportDefs = enabledDefs.filter(def => /transport/i.test(def.name));
  const vasyDefs = enabledDefs.filter(def => !/transport/i.test(def.name));

  if (transportDefs.length > 0) {
    const section = el('div', { className: 'section mt-md' });
    const title = el('div', { className: 'section__title' });
    title.textContent = 'Transport';
    title.style.color = '#2563eb';
    section.appendChild(title);
    section.appendChild(buildServiceList(transportDefs));
    wrapper.appendChild(section);
  }

  if (vasyDefs.length > 0) {
    const section = el('div', { className: 'section mt-md' });
    const title = el('div', { className: 'section__title' });
    title.textContent = 'VASY';
    title.style.color = '#7c3aed';
    section.appendChild(title);
    section.appendChild(buildServiceList(vasyDefs));
    wrapper.appendChild(section);
  }

  // Pallet types section
  const palletTypes = getPalletTypes();
  const palletTypesSection = el('div', { className: 'section mt-md' });
  palletTypesSection.appendChild(el('div', { className: 'section__title' }, 'Typy palet'));
  
  const palletTypesList = el('div', {
    className: 'service-list',
    style: { background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' },
  });
  
  const acceptedPalletTypes = contractor.acceptedPalletTypes || [];
  
  for (const palletType of palletTypes) {
    const isAccepted = acceptedPalletTypes.includes(palletType.id);
    
    const item = el('div', { 
      className: 'service-list__item', 
      style: { 
        flexDirection: 'column', 
        alignItems: 'stretch', 
        gap: '10px'
      } 
    });

    // Top row: checkbox + name + buttons
    const topRow = el('div', { className: 'flex items-center justify-between' });

    const nameContainer = el('div', { className: 'flex items-center gap-sm' });
    
    // Checkbox for enable/disable
    const checkbox = el('input', {
      type: 'checkbox',
      onChange: async (e) => {
        // Prevent multiple simultaneous calls
        if (checkbox.disabled) {
          console.log('Checkbox already processing, ignoring click');
          return;
        }
        
        const willBeChecked = e.target.checked;
        
        // Disable checkbox during update
        checkbox.disabled = true;
        
        try {
          const freshContractor = getContractorById(selectedId);
          if (!freshContractor) {
            console.error('Contractor not found:', selectedId);
            e.target.checked = !willBeChecked;
            return;
          }
          
          const currentAccepted = freshContractor.acceptedPalletTypes || [];
          const alreadyPresent = currentAccepted.includes(palletType.id);
          let newAccepted;
          
          console.log('Checkbox state:', {
            willBeChecked,
            palletTypeId: palletType.id,
            alreadyPresent,
            currentAccepted: [...currentAccepted]
          });
          
          if (willBeChecked) {
            // Add if not already present
            if (alreadyPresent) {
              console.log('Already present, no change needed');
              newAccepted = currentAccepted;
            } else {
              console.log('Adding to list');
              newAccepted = [...currentAccepted, palletType.id];
            }
          } else {
            // Remove from list
            console.log('Removing from list');
            newAccepted = currentAccepted.filter(id => {
              const keep = id !== palletType.id;
              console.log(`  Checking ${id} vs ${palletType.id}: keep=${keep}`);
              return keep;
            });
          }
          
          console.log('Update result:', {
            before: [...currentAccepted],
            after: [...newAccepted],
            changed: currentAccepted.length !== newAccepted.length
          });
          
          // Only update if changed
          if (JSON.stringify(currentAccepted) !== JSON.stringify(newAccepted)) {
            await updateContractor(freshContractor.id, { acceptedPalletTypes: newAccepted });
          } else {
            console.log('No change detected, skipping update');
          }
          
        } catch (error) {
          console.error('Error updating contractor:', error);
          // Revert on error
          e.target.checked = !willBeChecked;
        } finally {
          checkbox.disabled = false;
        }
      },
    });
    
    // Set checked state after element creation
    checkbox.checked = isAccepted;
    
    nameContainer.appendChild(checkbox);
    
    nameContainer.appendChild(el('span', { 
      className: 'service-list__name'
    }, palletType.name));
    
    if (palletType.dimensions) {
      nameContainer.appendChild(el('span', { 
        className: 'service-list__unit'
      }, palletType.dimensions));
    }
    
    topRow.appendChild(nameContainer);

    const buttonGroup = el('div', { className: 'flex gap-sm' });
    
    // Price buttons for IN and OUT
    if (isAccepted) {
      const pricesIn = getPalletPrices(selectedId, palletType.id, 'in');
      const pricesOut = getPalletPrices(selectedId, palletType.id, 'out');
      
      const priceInBtn = el('button', {
        className: 'btn-secondary btn-small',
        onClick: () => {
          // Open price editor for pallet type IN
          openPalletPriceEditor(selectedId, palletType.id, 'in');
        },
      }, 'Cennik WEJ');
      buttonGroup.appendChild(priceInBtn);
      
      const priceOutBtn = el('button', {
        className: 'btn-secondary btn-small',
        onClick: () => {
          // Open price editor for pallet type OUT
          openPalletPriceEditor(selectedId, palletType.id, 'out');
        },
      }, 'Cennik WYJ');
      buttonGroup.appendChild(priceOutBtn);
    }
    
    topRow.appendChild(buttonGroup);
    item.appendChild(topRow);

    // Price history (if accepted)
    if (isAccepted) {
      const pricesIn = getPalletPrices(selectedId, palletType.id, 'in');
      const pricesOut = getPalletPrices(selectedId, palletType.id, 'out');
      
      if (pricesIn.length > 0 || pricesOut.length > 0) {
        const priceHistory = el('div', { className: 'price-history' });
        
        // IN prices
        if (pricesIn.length > 0) {
          const inLabel = el('div', { style: { fontWeight: '600', fontSize: '0.75rem', marginLeft: '26px', marginTop: '4px', color: '#059669' } });
          inLabel.textContent = 'WEJŚCIA:';
          priceHistory.appendChild(inLabel);
          
          for (const p of pricesIn) {
            const row = el('div', { className: 'price-history__row' });
            row.appendChild(el('span', { className: 'price-history__date' }, `Od ${formatDatePL(p.effectiveFrom)}`));
            row.appendChild(el('span', { className: 'price-history__price' }, `${p.pricePerUnit.toFixed(2)} zł/szt`));
            priceHistory.appendChild(row);
          }
        }
        
        // OUT prices
        if (pricesOut.length > 0) {
          const outLabel = el('div', { style: { fontWeight: '600', fontSize: '0.75rem', marginLeft: '26px', marginTop: '8px', color: '#dc2626' } });
          outLabel.textContent = 'WYJŚCIA:';
          priceHistory.appendChild(outLabel);
          
          for (const p of pricesOut) {
            const row = el('div', { className: 'price-history__row' });
            row.appendChild(el('span', { className: 'price-history__date' }, `Od ${formatDatePL(p.effectiveFrom)}`));
            row.appendChild(el('span', { className: 'price-history__price' }, `${p.pricePerUnit.toFixed(2)} zł/szt`));
            priceHistory.appendChild(row);
          }
        }
        
        item.appendChild(priceHistory);
      } else {
        item.appendChild(el('p', {
          className: 'text-secondary',
          style: { fontSize: '0.8rem', marginLeft: '26px' },
        }, 'Brak zdefiniowanych stawek. Kliknij "Cennik WEJ" lub "Cennik WYJ", aby dodać.'));
      }
    }

    palletTypesList.appendChild(item);
  }
  
  palletTypesSection.appendChild(palletTypesList);
  wrapper.appendChild(palletTypesSection);

  return wrapper;
}
