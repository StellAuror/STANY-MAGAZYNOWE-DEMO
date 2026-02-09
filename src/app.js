import indexedDbAdapter from './adapters/indexedDbAdapter.js';
import { setAdapter, loadAllData, seedInitialData, setCurrentUser } from './store/actions.js';
import { subscribe, getState } from './store/store.js';
import { getCurrentUser, getActiveWarehouseId, getWarehouses } from './store/selectors.js';
import { WarehouseSwitch } from './components/WarehouseSwitch.js';
import { Tabs, getWarehouseHeaderColor } from './components/Tabs.js';
import { InventoryModal } from './components/InventoryModal.js';
import { PriceHistoryEditor } from './components/PriceHistoryEditor.js';
import { PalletPriceEditor } from './components/PalletPriceEditor.js';
import { getActiveView } from './router.js';
import { el, clearElement } from './utils/dom.js';

async function bootstrap() {
  // Initialize adapter
  setAdapter(indexedDbAdapter);
  await indexedDbAdapter.init();

  // Load data and seed if needed
  await loadAllData();
  await seedInitialData();
  // Reload after seeding to pick up all data
  await loadAllData();

  // Subscribe before first render so future state changes trigger re-render
  subscribe(() => render());

  // First render — synchronous, immediate
  doRender();
}

let renderScheduled = false;

function render() {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    doRender();
  });
}

function doRender() {
  try {
    const sidebarEl = document.getElementById('app-sidebar');
    const headerEl = document.getElementById('app-header');
    const mainEl = document.getElementById('app-main');
    const modalRoot = document.getElementById('modal-root');
    const warehouseId = getActiveWarehouseId();

    // Sidebar: navigation tabs + user bar at bottom
    clearElement(sidebarEl);
    
    const navContainer = el('div', { className: 'sidebar-nav-container' });
    navContainer.appendChild(Tabs());
    sidebarEl.appendChild(navContainer);
    
    // User bar at bottom of sidebar
    const userBar = el('div', { className: 'sidebar-user-bar' });
    userBar.appendChild(el('label', { className: 'sidebar-user-label' }, 'Użytkownik'));
    const userInput = el('input', {
      type: 'text',
      value: getCurrentUser(),
      placeholder: 'Imię / nazwa',
      className: 'sidebar-user-input',
      onChange: (e) => setCurrentUser(e.target.value),
    });
    userBar.appendChild(userInput);
    sidebarEl.appendChild(userBar);

    // Header: title + warehouse switch with warehouse color (only for inventory view)
    clearElement(headerEl);
    const state = getState();
    const activeTab = state.activeTab || 'inventory';
    const headerColor = activeTab === 'inventory' ? getWarehouseHeaderColor(warehouseId) : '#374151';
    headerEl.style.backgroundColor = headerColor;

    // Title
    headerEl.appendChild(el('h1', { className: 'header-title' }, 'INDEKA — System Magazynowy'));

    // Warehouse switch - only visible in inventory tab
    if (activeTab === 'inventory') {
      headerEl.appendChild(WarehouseSwitch());
    } else {
      // Add spacer to maintain header height
      const spacer = el('div', { style: { height: '48px' } });
      headerEl.appendChild(spacer);
    }

    // Main content
    clearElement(mainEl);
    
    // Set background icon based on active warehouse
    if (activeTab === 'inventory') {
      const warehouses = getWarehouses();
      const activeWarehouse = warehouses.find(w => w.id === warehouseId);
      if (activeWarehouse && activeWarehouse.icon) {
        // Create background icon element
        const bgIcon = el('div', {
          className: 'warehouse-bg-icon',
          innerHTML: activeWarehouse.icon
        });
        mainEl.appendChild(bgIcon);
      }
    }
    
    const view = getActiveView();
    if (view) mainEl.appendChild(view);

    // Modals
    clearElement(modalRoot);
    const inventoryModal = InventoryModal();
    if (inventoryModal) modalRoot.appendChild(inventoryModal);

    const priceEditor = PriceHistoryEditor();
    if (priceEditor) modalRoot.appendChild(priceEditor);
    
    const palletPriceEditor = PalletPriceEditor();
    if (palletPriceEditor) modalRoot.appendChild(palletPriceEditor);
  } catch (err) {
    console.error('Render error:', err);
  }
}

bootstrap().catch(err => {
  console.error('Bootstrap error:', err);
  const mainEl = document.getElementById('app-main');
  if (mainEl) {
    mainEl.textContent = 'Błąd inicjalizacji: ' + (err.message || err);
  }
});
