import { today } from '../utils/date.js';

/**
 * Application state store with subscription support.
 */

const state = {
  // Data
  warehouses: [],
  contractors: [],
  serviceDefinitions: [],
  contractorServices: [],
  servicePrices: [],
  palletPrices: [],
  dailyInventory: [],
  palletTypes: [],
  auditLog: [],

  // UI state
  activeWarehouseId: null,
  activeTab: 'inventory', // 'inventory' | 'contractor' | 'summary' | 'pallets'
  selectedDate: today(),
  selectedContractorId: null,
  selectedMonth: today().slice(0, 7),
  selectedSummaryContractors: [], // array of IDs
  selectedSummaryWarehouse: 'all', // 'all' or warehouseId
  currentUser: 'Użytkownik',

  // Modal state
  modalOpen: false,
  modalContractorId: null,
  modalWarehouseId: null,
  modalDate: null,

  // Price editor state
  priceEditorOpen: false,
  priceEditorContractorId: null,
  priceEditorServiceId: null,
  
  // Pallet price editor state
  palletPriceEditorOpen: false,
  palletPriceEditorContractorId: null,
  palletPriceEditorPalletTypeId: null,
  palletPriceEditorDirection: null, // 'in' or 'out'
};

/** @type {Set<(state: typeof state) => void>} */
const listeners = new Set();

/** Subscribe to state changes */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Notify all subscribers */
function notify() {
  for (const fn of listeners) {
    try { fn(state); } catch (e) { console.error('Store subscriber error:', e); }
  }
}

/** Get current state (read-only reference) */
export function getState() {
  return state;
}

/** Update state and notify */
export function setState(partial) {
  Object.assign(state, partial);
  notify();
}

export default { getState, setState, subscribe };
