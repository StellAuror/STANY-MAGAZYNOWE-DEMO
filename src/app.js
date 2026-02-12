import indexedDbAdapter from './adapters/indexedDbAdapter.js';
import { setAdapter, loadAllData, seedInitialData, setCurrentUser, clearAllDataAndReseed } from './store/actions.js';
import { subscribe, getState } from './store/store.js';
import { getCurrentUser, getActiveWarehouseId, getWarehouses } from './store/selectors.js';
import { WarehouseSwitch } from './components/WarehouseSwitch.js';
import { Tabs, getWarehouseHeaderColor } from './components/Tabs.js';
import { InventoryModal } from './components/InventoryModal.js';
import { PriceHistoryEditor } from './components/PriceHistoryEditor.js';
import { PalletPriceEditor } from './components/PalletPriceEditor.js';
import { getActiveView } from './router.js';
import { el, clearElement } from './utils/dom.js';
import { getSelectedDate } from './store/selectors.js';
import { setSelectedDate } from './store/actions.js';
import { today, parseISODate } from './utils/date.js';

/**
 * Inline calendar component for sidebar — always visible, clickable days.
 */
function InlineCalendar(selectedDate, onSelect) {
  const selDate = parseISODate(selectedDate);
  let viewYear = selDate.getFullYear();
  let viewMonth = selDate.getMonth();

  const container = el('div', { className: 'calendar sidebar-calendar' });

  function render() {
    container.innerHTML = '';

    // Navigation row
    const nav = el('div', { className: 'calendar__nav' });

    const prevBtn = el('button', {
      className: 'calendar__nav-btn',
      onClick: () => { viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; } render(); },
    }, '\u2039');

    const monthLabel = el('span', { className: 'calendar__month-label' },
      new Date(viewYear, viewMonth, 1).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })
    );

    const todayBtn = el('button', {
      className: 'calendar__nav-btn calendar__today-btn',
      title: 'Dzisiaj',
      onClick: () => {
        const t = today();
        const td = parseISODate(t);
        viewYear = td.getFullYear();
        viewMonth = td.getMonth();
        onSelect(t);
      },
    }, 'Dzi\u015B');

    const nextBtn = el('button', {
      className: 'calendar__nav-btn',
      onClick: () => { viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; } render(); },
    }, '\u203A');

    nav.appendChild(prevBtn);
    nav.appendChild(monthLabel);
    nav.appendChild(todayBtn);
    nav.appendChild(nextBtn);
    container.appendChild(nav);

    // Weekday headers (Mon-Sun, Polish)
    const weekdays = el('div', { className: 'calendar__weekdays' });
    const dayNames = ['Pn', 'Wt', '\u015Ar', 'Cz', 'Pt', 'Sb', 'Nd'];
    for (const name of dayNames) {
      weekdays.appendChild(el('div', { className: 'calendar__weekday' }, name));
    }
    container.appendChild(weekdays);

    // Days grid
    const daysGrid = el('div', { className: 'calendar__days' });

    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const daysInMonth = lastDay.getDate();

    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const todayStr = today();

    // Previous month trailing days
    const prevMonthLastDay = new Date(viewYear, viewMonth, 0).getDate();
    for (let i = startDow - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const btn = el('button', {
        className: 'calendar__day calendar__day--other-month',
        onClick: () => {
          let pm = viewMonth - 1;
          let py = viewYear;
          if (pm < 0) { pm = 11; py--; }
          const iso = `${py}-${String(pm + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
          viewMonth = pm;
          viewYear = py;
          onSelect(iso);
        },
      }, String(dayNum));
      daysGrid.appendChild(btn);
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dow = new Date(viewYear, viewMonth, d).getDay();
      const isWeekend = dow === 0 || dow === 6;
      const isSelected = iso === selectedDate;
      const isToday = iso === todayStr;

      let cls = 'calendar__day';
      if (isSelected) cls += ' calendar__day--selected';
      if (isToday && !isSelected) cls += ' calendar__day--today';
      if (isWeekend) cls += ' calendar__day--weekend';

      const btn = el('button', {
        className: cls,
        onClick: () => onSelect(iso),
      }, String(d));

      daysGrid.appendChild(btn);
    }

    // Next month leading days to fill grid
    const totalCells = startDow + daysInMonth;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let d = 1; d <= remaining; d++) {
      const btn = el('button', {
        className: 'calendar__day calendar__day--other-month',
        onClick: () => {
          let nm = viewMonth + 1;
          let ny = viewYear;
          if (nm > 11) { nm = 0; ny++; }
          const iso = `${ny}-${String(nm + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          viewMonth = nm;
          viewYear = ny;
          onSelect(iso);
        },
      }, String(d));
      daysGrid.appendChild(btn);
    }

    container.appendChild(daysGrid);
  }

  render();
  return container;
}

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

    // Calendar in sidebar (on top) — only for inventory tab
    const state = getState();
    const activeTab = state.activeTab || 'inventory';
    if (activeTab === 'inventory') {
      const selectedDate = getSelectedDate();
      const calendar = InlineCalendar(selectedDate, (newDate) => {
        setSelectedDate(newDate);
      });
      navContainer.appendChild(calendar);
    }

    // Navigation tabs below calendar
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
    
    // Reset button
    const resetBtn = el('button', {
      className: 'btn-reset-data',
      title: 'Resetuj dane demonstracyjne',
      onClick: async () => {
        if (confirm('Czy na pewno chcesz zresetować wszystkie dane i załadować dane demonstracyjne?')) {
          try {
            await clearAllDataAndReseed();
            alert('Dane zostały zresetowane!');
          } catch (err) {
            console.error('Reset error:', err);
            alert('Błąd podczas resetowania danych: ' + err.message);
          }
        }
      },
    }, '🔄 Resetuj dane');
    userBar.appendChild(resetBtn);
    
    sidebarEl.appendChild(userBar);

    // Header: title + warehouse switch with warehouse color (only for inventory view)
    clearElement(headerEl);
    const headerColor = activeTab === 'inventory' ? getWarehouseHeaderColor(warehouseId) : '#374151';
    headerEl.style.backgroundColor = headerColor;

    // Title
    headerEl.appendChild(el('h1', { className: 'header-title' }, 'System Magazynowy'));

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
