import { el } from '../utils/dom.js';
import { getActiveTab, getActiveWarehouseId } from '../store/selectors.js';
import { setActiveTab } from '../store/actions.js';

const TAB_DEFINITIONS = [
  { id: 'inventory', label: 'Stany magazynowe' },
  { id: 'contractor', label: 'Kontrahent' },
  { id: 'pallets', label: 'Rodzaje palet' },
  { id: 'summary', label: 'Podsumowanie' },
  { id: 'warehouses', label: 'Magazyny' },
  { id: 'audit', label: 'Audit Log' },
];

// Warehouse colors for header bar
const WAREHOUSE_HEADER_COLORS = {
  'wh1': '#1e40af',
  'wh2': '#15803d',
  'wh3': '#c2410c',
  'wh4': '#b91c1c',
};

/**
 * Sidebar navigation component.
 * Vertical tabs with warehouse color in header.
 */
export function Tabs() {
  const activeTab = getActiveTab();
  const warehouseId = getActiveWarehouseId();

  const container = el('div', { className: 'sidebar-nav' });

  for (const tab of TAB_DEFINITIONS) {
    const isActive = tab.id === activeTab;
    const btn = el('button', {
      className: `sidebar-nav__item${isActive ? ' sidebar-nav__item--active' : ''}`,
      onClick: () => setActiveTab(tab.id),
    }, tab.label);
    
    container.appendChild(btn);
  }

  return container;
}

/**
 * Get header background color for current warehouse
 */
export function getWarehouseHeaderColor(warehouseId) {
  return WAREHOUSE_HEADER_COLORS[warehouseId] || '#1e40af';
}
