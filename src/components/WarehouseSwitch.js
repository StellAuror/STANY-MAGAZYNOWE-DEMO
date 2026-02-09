import { el } from '../utils/dom.js';
import { getWarehouses, getActiveWarehouseId } from '../store/selectors.js';
import { setActiveWarehouse } from '../store/actions.js';

/**
 * Segment control for switching warehouses.
 * Animated pill follows active selection.
 * Full width with flexible items.
 */
export function WarehouseSwitch() {
  const warehouses = getWarehouses();
  const activeId = getActiveWarehouseId();

  const container = el('div', { className: 'warehouse-switch' });

  // Create the sliding pill
  const pill = el('div', { className: 'warehouse-switch__pill' });
  container.appendChild(pill);

  const buttons = [];

  warehouses.forEach((wh, idx) => {
    const isActive = wh.id === activeId;
    
    const iconSpan = el('span', { 
      className: 'warehouse-switch__icon',
      innerHTML: wh.icon || ''
    });
    
    const btn = el('button', {
      className: `warehouse-switch__item${isActive ? ' warehouse-switch__item--active' : ''}`,
      onClick: () => {
        setActiveWarehouse(wh.id);
      },
      'data-warehouse-id': wh.id,
    });
    
    btn.appendChild(iconSpan);
    btn.appendChild(document.createTextNode(wh.name));

    buttons.push(btn);
    container.appendChild(btn);
  });

  // Position the pill after DOM update
  setTimeout(() => {
    const activeIdx = warehouses.findIndex(w => w.id === activeId);
    if (activeIdx >= 0 && buttons[activeIdx]) {
      const btn = buttons[activeIdx];
      const containerRect = container.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();
      const relativeLeft = btnRect.left - containerRect.left;
      
      pill.style.width = btn.offsetWidth + 'px';
      pill.style.transform = `translateX(${relativeLeft}px)`;
    }
  }, 0);

  return container;
}

