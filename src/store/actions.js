import { getState, setState } from './store.js';
import { STORES } from '../adapters/dataAdapter.js';
import { generateId } from '../utils/format.js';

/** @type {import('../adapters/indexedDbAdapter.js').default} */
let adapter = null;

/** Set the data adapter (called at bootstrap) */
export function setAdapter(a) {
  adapter = a;
}

// --- UI Actions ---

export function setActiveWarehouse(warehouseId) {
  setState({ activeWarehouseId: warehouseId });
}

export function setActiveTab(tab) {
  setState({ activeTab: tab });
}

export function setSelectedDate(date) {
  setState({ selectedDate: date });
}

export function setSelectedContractor(contractorId) {
  setState({ selectedContractorId: contractorId });
}

export function setSelectedMonth(month) {
  setState({ selectedMonth: month });
}

export function setSummaryContractors(ids) {
  setState({ selectedSummaryContractors: ids });
}

export function setSummaryWarehouse(warehouseId) {
  setState({ selectedSummaryWarehouse: warehouseId });
}

export async function setCurrentUser(name) {
  setState({ currentUser: name });
  await adapter.put(STORES.SETTINGS, { key: 'currentUser', value: name });
}

// --- Modal Actions ---

export function openInventoryModal(contractorId, warehouseId, date) {
  setState({
    modalOpen: true,
    modalContractorId: contractorId,
    modalWarehouseId: warehouseId,
    modalDate: date,
  });
}

export function closeModal() {
  setState({
    modalOpen: false,
    modalContractorId: null,
    modalWarehouseId: null,
    modalDate: null,
  });
}

export function openPriceEditor(contractorId, serviceId) {
  setState({
    priceEditorOpen: true,
    priceEditorContractorId: contractorId,
    priceEditorServiceId: serviceId,
  });
}

export function closePriceEditor() {
  setState({
    priceEditorOpen: false,
    priceEditorContractorId: null,
    priceEditorServiceId: null,
  });
}

export function openPalletPriceEditor(contractorId, palletTypeId, direction) {
  setState({
    palletPriceEditorOpen: true,
    palletPriceEditorContractorId: contractorId,
    palletPriceEditorPalletTypeId: palletTypeId,
    palletPriceEditorDirection: direction,
  });
}

export function closePalletPriceEditor() {
  setState({
    palletPriceEditorOpen: false,
    palletPriceEditorContractorId: null,
    palletPriceEditorPalletTypeId: null,
    palletPriceEditorDirection: null,
  });
}

// --- Data Actions ---

export async function loadAllData() {
  const [warehouses, contractors, serviceDefinitions, contractorServices,
    servicePrices, palletPrices, dailyInventory, palletTypes, auditLog] = await Promise.all([
    adapter.getAll(STORES.WAREHOUSES),
    adapter.getAll(STORES.CONTRACTORS),
    adapter.getAll(STORES.SERVICE_DEFINITIONS),
    adapter.getAll(STORES.CONTRACTOR_SERVICES),
    adapter.getAll(STORES.SERVICE_PRICES),
    adapter.getAll(STORES.PALLET_PRICES),
    adapter.getAll(STORES.DAILY_INVENTORY),
    adapter.getAll(STORES.PALLET_TYPES),
    adapter.getAll(STORES.AUDIT_LOG),
  ]);

  // Migration: Add acceptedPalletTypes to contractors that don't have it
  const palletTypeIds = palletTypes.map(pt => pt.id);
  const migratedContractors = contractors.map(c => {
    if (!c.acceptedPalletTypes) {
      // Add all pallet types as default for existing contractors
      return { ...c, acceptedPalletTypes: palletTypeIds };
    }
    return c;
  });
  
  // Save migrated contractors
  const needsMigration = migratedContractors.some((c, i) => c.acceptedPalletTypes !== contractors[i].acceptedPalletTypes);
  if (needsMigration) {
    await Promise.all(migratedContractors.map(c => adapter.put(STORES.CONTRACTORS, c)));
  }

  const settings = await adapter.get(STORES.SETTINGS, 'currentUser');

  setState({
    warehouses,
    contractors: migratedContractors,
    serviceDefinitions,
    contractorServices,
    servicePrices,
    palletPrices,
    dailyInventory,
    palletTypes,
    auditLog,
    currentUser: settings?.value || 'Użytkownik',
    activeWarehouseId: warehouses.length > 0 ? warehouses.sort((a, b) => a.sortOrder - b.sortOrder)[0].id : null,
  });
}

// --- Contractor Actions ---

export async function addContractor(name) {
  const contractor = { id: generateId(), name, isActive: true, acceptedPalletTypes: [] };
  await adapter.put(STORES.CONTRACTORS, contractor);
  setState({ contractors: [...getState().contractors, contractor] });
  
  // Auto-enable pallets in/out services for new contractor
  await enableServiceForContractor(contractor.id, 'svc-pallets-in');
  await enableServiceForContractor(contractor.id, 'svc-pallets-out');
  
  return contractor;
}

export async function updateContractor(id, updates) {
  const oldContractors = getState().contractors;
  const contractors = oldContractors.map(c =>
    c.id === id ? { ...c, ...updates } : c
  );
  const updated = contractors.find(c => c.id === id);
  
  console.log('updateContractor:', {
    id,
    updates,
    oldData: oldContractors.find(c => c.id === id),
    newData: updated
  });
  
  await adapter.put(STORES.CONTRACTORS, updated);
  setState({ contractors });
  
  console.log('State updated, contractors count:', contractors.length);
}

// --- Daily Inventory Actions ---

export async function saveDailyRecord(record) {
  await adapter.put(STORES.DAILY_INVENTORY, record);
  const existing = getState().dailyInventory;
  const idx = existing.findIndex(r => r.id === record.id);
  if (idx >= 0) {
    const updated = [...existing];
    updated[idx] = record;
    setState({ dailyInventory: updated });
  } else {
    setState({ dailyInventory: [...existing, record] });
  }
}

// --- Audit Actions ---

export async function addAuditEntry(entry) {
  const auditEntry = { id: generateId(), ...entry };
  await adapter.put(STORES.AUDIT_LOG, auditEntry);
  setState({ auditLog: [...getState().auditLog, auditEntry] });
}

// --- Contractor Service Actions ---

export async function toggleContractorService(contractorId, serviceId, isEnabled) {
  const existing = getState().contractorServices.find(
    cs => cs.contractorId === contractorId && cs.serviceId === serviceId
  );

  if (existing) {
    const updated = { ...existing, isEnabled };
    await adapter.put(STORES.CONTRACTOR_SERVICES, updated);
    setState({
      contractorServices: getState().contractorServices.map(cs =>
        cs.id === existing.id ? updated : cs
      ),
    });
  } else {
    const cs = { id: generateId(), contractorId, serviceId, isEnabled };
    await adapter.put(STORES.CONTRACTOR_SERVICES, cs);
    setState({ contractorServices: [...getState().contractorServices, cs] });
  }
}

export async function removeContractorService(contractorId, serviceId) {
  const existing = getState().contractorServices.find(
    cs => cs.contractorId === contractorId && cs.serviceId === serviceId
  );
  
  if (existing) {
    await adapter.delete(STORES.CONTRACTOR_SERVICES, existing.id);
    setState({
      contractorServices: getState().contractorServices.filter(cs => cs.id !== existing.id),
    });
  }
}

export async function enableServiceForContractor(contractorId, serviceId) {
  const existing = getState().contractorServices.find(
    cs => cs.contractorId === contractorId && cs.serviceId === serviceId
  );

  if (existing) {
    const updated = { ...existing, isEnabled: true };
    await adapter.put(STORES.CONTRACTOR_SERVICES, updated);
    setState({
      contractorServices: getState().contractorServices.map(cs =>
        cs.id === existing.id ? updated : cs
      ),
    });
  } else {
    const cs = { id: generateId(), contractorId, serviceId, isEnabled: true };
    await adapter.put(STORES.CONTRACTOR_SERVICES, cs);
    setState({ contractorServices: [...getState().contractorServices, cs] });
  }
}


// --- Service Price Actions ---

export async function addServicePrice(priceRecord) {
  const record = { id: generateId(), ...priceRecord, createdAt: Date.now(), updatedAt: Date.now() };
  await adapter.put(STORES.SERVICE_PRICES, record);
  setState({ servicePrices: [...getState().servicePrices, record] });
  return record;
}

export async function updateServicePrice(id, updates) {
  const prices = getState().servicePrices.map(p =>
    p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
  );
  const updated = prices.find(p => p.id === id);
  await adapter.put(STORES.SERVICE_PRICES, updated);
  setState({ servicePrices: prices });
}

// --- Pallet Prices Actions ---

export async function addPalletPrice(priceRecord) {
  const record = { id: generateId(), ...priceRecord, createdAt: Date.now(), updatedAt: Date.now() };
  await adapter.put(STORES.PALLET_PRICES, record);
  setState({ palletPrices: [...getState().palletPrices, record] });
  return record;
}

export async function updatePalletPrice(id, updates) {
  const prices = getState().palletPrices.map(p =>
    p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
  );
  const updated = prices.find(p => p.id === id);
  await adapter.put(STORES.PALLET_PRICES, updated);
  setState({ palletPrices: prices });
}

// --- Pallet Types Actions ---

export async function addPalletType(palletType) {
  const record = { id: generateId(), ...palletType, createdAt: Date.now(), updatedAt: Date.now() };
  await adapter.put(STORES.PALLET_TYPES, record);
  setState({ palletTypes: [...getState().palletTypes, record] });
  return record;
}

export async function updatePalletType(id, updates) {
  const types = getState().palletTypes.map(t =>
    t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t
  );
  const updated = types.find(t => t.id === id);
  await adapter.put(STORES.PALLET_TYPES, updated);
  setState({ palletTypes: types });
}

export async function deletePalletType(id) {
  await adapter.delete(STORES.PALLET_TYPES, id);
  setState({ palletTypes: getState().palletTypes.filter(t => t.id !== id) });
}

// --- Seed Data ---

export async function seedInitialData() {
  const state = getState();

  // --- Warehouses ---
  // Always update warehouses to ensure they have icons
  const warehousesWithIcons = [
    { id: 'wh1', name: 'Magazyn 1', sortOrder: 1, 
      icon: '<img src="imgs/pngtree-black-elephant-on-a-white-wall-vector-png-image_6951789.png" alt="Słoń">' },
    { id: 'wh2', name: 'Magazyn 2', sortOrder: 2, 
      icon: '<img src="imgs/73168.png" alt="Wieloryb">' },
    { id: 'wh3', name: 'Magazyn 3', sortOrder: 3, 
      icon: '<img src="imgs/47441.png" alt="Foka">' },
    { id: 'wh4', name: 'Magazyn 4', sortOrder: 4, 
      icon: '<img src="imgs/42901-200.png" alt="Niedźwiedź">' },
  ];
  
  if (state.warehouses.length === 0) {
    await adapter.putMany(STORES.WAREHOUSES, warehousesWithIcons);
  } else {
    // Update existing warehouses to add icons
    await adapter.putMany(STORES.WAREHOUSES, warehousesWithIcons);
  }
  setState({ warehouses: warehousesWithIcons });

  // --- Service definitions ---
  if (state.serviceDefinitions.length === 0) {
    const services = [
      { id: 'svc-pallets-in', name: 'Wejście palet', unit: 'PALLET', description: 'Przyjęcie palet na magazyn' },
      { id: 'svc-pallets-out', name: 'Wyjście palet', unit: 'PALLET', description: 'Wydanie palet z magazynu' },
      { id: 'svc-storage', name: 'Stan magazynowy', unit: 'PALLET', description: 'Opłata za stan magazynowy (gdy brak ruchów)' },
      { id: 'svc1', name: 'Transport', unit: 'KM', description: 'Usługa transportowa' },
      { id: 'svc2', name: 'Magazynowanie', unit: 'PALLET', description: 'Składowanie na paletach' },
      { id: 'svc3', name: 'Pakowanie', unit: 'PIECE', description: 'Usługa pakowania' },
      { id: 'svc4', name: 'Przeładunek', unit: 'HOUR', description: 'Przeładunek towarów' },
    ];
    await adapter.putMany(STORES.SERVICE_DEFINITIONS, services);
    setState({ serviceDefinitions: services });
  }

  // --- Pallet types ---
  if (state.palletTypes.length === 0) {
    const palletTypes = [
      { id: 'plt-euro', name: 'Euro paleta', dimensions: '1200x800x144 mm', maxLoad: '1500 kg', notes: 'Standardowa paleta europejska (EUR/EPAL)' },
      { id: 'plt-industrial', name: 'Paleta przemysłowa', dimensions: '1200x1000x144 mm', maxLoad: '2000 kg', notes: 'Paleta o większej powierzchni' },
      { id: 'plt-display', name: 'Paleta displayowa', dimensions: '600x800x144 mm', maxLoad: '500 kg', notes: 'Pół-paleta do ekspozycji' },
    ];
    await adapter.putMany(STORES.PALLET_TYPES, palletTypes);
    setState({ palletTypes });
  }

  // --- Demo data (only if no contractors exist yet) ---
  if (state.contractors.length > 0) return;
  
  // Get fresh state after pallet types update
  const updatedState = getState();
  await seedDemoData(updatedState.palletTypes);
}

/** Deterministic pseudo-random based on seed string */
function seededRandom(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return () => {
    h = (h * 16807 + 0) % 2147483647;
    return (h & 0x7fffffff) / 2147483647;
  };
}

async function seedDemoData(palletTypes) {
  const rng = seededRandom('indeka-demo-2026');
  const now = Date.now();

  // Get pallet type IDs to assign to contractors
  const palletTypeIds = palletTypes.map(pt => pt.id);

  // --- Contractors ---  
  const contractors = [
    { id: 'ctr1', name: 'Budimex S.A.', isActive: true, acceptedPalletTypes: palletTypeIds },
    { id: 'ctr2', name: 'Polskie Składy Sp. z o.o.', isActive: true, acceptedPalletTypes: palletTypeIds },
    { id: 'ctr3', name: 'EkoLogistyka', isActive: true, acceptedPalletTypes: palletTypeIds },
    { id: 'ctr4', name: 'Jan Kowalski Transport', isActive: true, acceptedPalletTypes: palletTypeIds },
    { id: 'ctr5', name: 'MegaPak Sp.J.', isActive: true, acceptedPalletTypes: palletTypeIds },
  ];
  await adapter.putMany(STORES.CONTRACTORS, contractors);

  // --- Contractor-service assignments ---
  const csAssignments = [
    // === USŁUGI PALLETOWE (DOMYŚLNE DLA WSZYSTKICH) ===
    { id: 'cs-pal-1',  contractorId: 'ctr1', serviceId: 'svc-pallets-in',  isEnabled: true },
    { id: 'cs-pal-2',  contractorId: 'ctr1', serviceId: 'svc-pallets-out', isEnabled: true },
    { id: 'cs-pal-3',  contractorId: 'ctr2', serviceId: 'svc-pallets-in',  isEnabled: true },
    { id: 'cs-pal-4',  contractorId: 'ctr2', serviceId: 'svc-pallets-out', isEnabled: true },
    { id: 'cs-pal-5',  contractorId: 'ctr3', serviceId: 'svc-pallets-in',  isEnabled: true },
    { id: 'cs-pal-6',  contractorId: 'ctr3', serviceId: 'svc-pallets-out', isEnabled: true },
    { id: 'cs-pal-7',  contractorId: 'ctr4', serviceId: 'svc-pallets-in',  isEnabled: true },
    { id: 'cs-pal-8',  contractorId: 'ctr4', serviceId: 'svc-pallets-out', isEnabled: true },
    { id: 'cs-pal-9',  contractorId: 'ctr5', serviceId: 'svc-pallets-in',  isEnabled: true },
    { id: 'cs-pal-10', contractorId: 'ctr5', serviceId: 'svc-pallets-out', isEnabled: true },
    
    // === USŁUGI DODATKOWE ===
    { id: 'cs1',  contractorId: 'ctr1', serviceId: 'svc1', isEnabled: true },
    { id: 'cs2',  contractorId: 'ctr1', serviceId: 'svc2', isEnabled: true },
    { id: 'cs3',  contractorId: 'ctr1', serviceId: 'svc4', isEnabled: true },
    { id: 'cs4',  contractorId: 'ctr2', serviceId: 'svc2', isEnabled: true },
    { id: 'cs5',  contractorId: 'ctr2', serviceId: 'svc3', isEnabled: true },
    { id: 'cs6',  contractorId: 'ctr3', serviceId: 'svc1', isEnabled: true },
    { id: 'cs7',  contractorId: 'ctr3', serviceId: 'svc3', isEnabled: true },
    { id: 'cs8',  contractorId: 'ctr3', serviceId: 'svc4', isEnabled: true },
    { id: 'cs9',  contractorId: 'ctr4', serviceId: 'svc1', isEnabled: true },
    { id: 'cs10', contractorId: 'ctr5', serviceId: 'svc3', isEnabled: true },
    { id: 'cs11', contractorId: 'ctr5', serviceId: 'svc2', isEnabled: true },
  ];
  await adapter.putMany(STORES.CONTRACTOR_SERVICES, csAssignments);

  // --- Service prices (with history — rate changes mid-period) ---
  const prices = [
    // === CENY DLA USŁUG PODSTAWOWYCH (pallets in/out, storage) ===
    // Każdy kontrahent ma te same stawki podstawowe
    // Wejście palet: 3 zł/paleta
    { id: 'sp-base-1',  contractorId: 'ctr1', serviceId: 'svc-pallets-in',  effectiveFrom: '2025-12-01', pricePerUnit: 3.00,  createdAt: now, updatedAt: now },
    { id: 'sp-base-2',  contractorId: 'ctr2', serviceId: 'svc-pallets-in',  effectiveFrom: '2025-12-01', pricePerUnit: 3.00,  createdAt: now, updatedAt: now },
    { id: 'sp-base-3',  contractorId: 'ctr3', serviceId: 'svc-pallets-in',  effectiveFrom: '2025-12-01', pricePerUnit: 3.00,  createdAt: now, updatedAt: now },
    { id: 'sp-base-4',  contractorId: 'ctr4', serviceId: 'svc-pallets-in',  effectiveFrom: '2025-12-01', pricePerUnit: 3.00,  createdAt: now, updatedAt: now },
    { id: 'sp-base-5',  contractorId: 'ctr5', serviceId: 'svc-pallets-in',  effectiveFrom: '2025-12-01', pricePerUnit: 3.00,  createdAt: now, updatedAt: now },
    // Wyjście palet: 2.50 zł/paleta
    { id: 'sp-base-6',  contractorId: 'ctr1', serviceId: 'svc-pallets-out', effectiveFrom: '2025-12-01', pricePerUnit: 2.50,  createdAt: now, updatedAt: now },
    { id: 'sp-base-7',  contractorId: 'ctr2', serviceId: 'svc-pallets-out', effectiveFrom: '2025-12-01', pricePerUnit: 2.50,  createdAt: now, updatedAt: now },
    { id: 'sp-base-8',  contractorId: 'ctr3', serviceId: 'svc-pallets-out', effectiveFrom: '2025-12-01', pricePerUnit: 2.50,  createdAt: now, updatedAt: now },
    { id: 'sp-base-9',  contractorId: 'ctr4', serviceId: 'svc-pallets-out', effectiveFrom: '2025-12-01', pricePerUnit: 2.50,  createdAt: now, updatedAt: now },
    { id: 'sp-base-10', contractorId: 'ctr5', serviceId: 'svc-pallets-out', effectiveFrom: '2025-12-01', pricePerUnit: 2.50,  createdAt: now, updatedAt: now },
    // Stan magazynowy: 1 zł/paleta/dzień
    { id: 'sp-base-11', contractorId: 'ctr1', serviceId: 'svc-storage',     effectiveFrom: '2025-12-01', pricePerUnit: 1.00,  createdAt: now, updatedAt: now },
    { id: 'sp-base-12', contractorId: 'ctr2', serviceId: 'svc-storage',     effectiveFrom: '2025-12-01', pricePerUnit: 1.00,  createdAt: now, updatedAt: now },
    { id: 'sp-base-13', contractorId: 'ctr3', serviceId: 'svc-storage',     effectiveFrom: '2025-12-01', pricePerUnit: 1.00,  createdAt: now, updatedAt: now },
    { id: 'sp-base-14', contractorId: 'ctr4', serviceId: 'svc-storage',     effectiveFrom: '2025-12-01', pricePerUnit: 1.00,  createdAt: now, updatedAt: now },
    { id: 'sp-base-15', contractorId: 'ctr5', serviceId: 'svc-storage',     effectiveFrom: '2025-12-01', pricePerUnit: 1.00,  createdAt: now, updatedAt: now },
    
    // === CENY DLA USŁUG DODATKOWYCH ===
    // Budimex — Transport: 5 zl/km from Dec, 6.50 zl/km from Feb
    { id: 'sp1',  contractorId: 'ctr1', serviceId: 'svc1', effectiveFrom: '2025-12-01', pricePerUnit: 5.00,  createdAt: now, updatedAt: now },
    { id: 'sp2',  contractorId: 'ctr1', serviceId: 'svc1', effectiveFrom: '2026-02-01', pricePerUnit: 6.50,  createdAt: now, updatedAt: now },
    // Budimex — Magazynowanie: 12 zl/paleta
    { id: 'sp3',  contractorId: 'ctr1', serviceId: 'svc2', effectiveFrom: '2025-12-01', pricePerUnit: 12.00, createdAt: now, updatedAt: now },
    // Budimex — Przeladunek: 45 zl/h from Dec, 50 zl/h from Feb
    { id: 'sp4',  contractorId: 'ctr1', serviceId: 'svc4', effectiveFrom: '2025-12-01', pricePerUnit: 45.00, createdAt: now, updatedAt: now },
    { id: 'sp5',  contractorId: 'ctr1', serviceId: 'svc4', effectiveFrom: '2026-02-01', pricePerUnit: 50.00, createdAt: now, updatedAt: now },
    // Polskie Sklady — Magazynowanie: 10 zl/paleta
    { id: 'sp6',  contractorId: 'ctr2', serviceId: 'svc2', effectiveFrom: '2025-12-01', pricePerUnit: 10.00, createdAt: now, updatedAt: now },
    // Polskie Sklady — Pakowanie: 2.50 zl/szt from Dec, 3 zl/szt from Jan
    { id: 'sp7',  contractorId: 'ctr2', serviceId: 'svc3', effectiveFrom: '2025-12-01', pricePerUnit: 2.50,  createdAt: now, updatedAt: now },
    { id: 'sp8',  contractorId: 'ctr2', serviceId: 'svc3', effectiveFrom: '2026-01-01', pricePerUnit: 3.00,  createdAt: now, updatedAt: now },
    // EkoLogistyka — Transport: 4.80 zl/km
    { id: 'sp9',  contractorId: 'ctr3', serviceId: 'svc1', effectiveFrom: '2025-12-01', pricePerUnit: 4.80,  createdAt: now, updatedAt: now },
    // EkoLogistyka — Pakowanie: 1.80 zl/szt
    { id: 'sp10', contractorId: 'ctr3', serviceId: 'svc3', effectiveFrom: '2025-12-01', pricePerUnit: 1.80,  createdAt: now, updatedAt: now },
    // EkoLogistyka — Przeladunek: 40 zl/h from Dec, 42 zl/h from Feb
    { id: 'sp11', contractorId: 'ctr3', serviceId: 'svc4', effectiveFrom: '2025-12-01', pricePerUnit: 40.00, createdAt: now, updatedAt: now },
    { id: 'sp12', contractorId: 'ctr3', serviceId: 'svc4', effectiveFrom: '2026-02-01', pricePerUnit: 42.00, createdAt: now, updatedAt: now },
    // Jan Kowalski — Transport: 7 zl/km
    { id: 'sp13', contractorId: 'ctr4', serviceId: 'svc1', effectiveFrom: '2025-12-01', pricePerUnit: 7.00,  createdAt: now, updatedAt: now },
    // MegaPak — Pakowanie: 2.00 zl/szt from Dec, 2.20 zl/szt from mid-Jan
    { id: 'sp14', contractorId: 'ctr5', serviceId: 'svc3', effectiveFrom: '2025-12-01', pricePerUnit: 2.00,  createdAt: now, updatedAt: now },
    { id: 'sp15', contractorId: 'ctr5', serviceId: 'svc3', effectiveFrom: '2026-01-15', pricePerUnit: 2.20,  createdAt: now, updatedAt: now },
    // MegaPak — Magazynowanie: 9.50 zl/paleta
    { id: 'sp16', contractorId: 'ctr5', serviceId: 'svc2', effectiveFrom: '2025-12-01', pricePerUnit: 9.50,  createdAt: now, updatedAt: now },
  ];
  await adapter.putMany(STORES.SERVICE_PRICES, prices);

  // --- Daily inventory records for Dec 2025, Jan 2026, Feb 2026 ---

  const months = [
    { y: 2025, m: 12 },
    { y: 2026, m: 1 },
    { y: 2026, m: 2, maxDay: 14 }, // Only first 2 weeks of February
  ];

  const profiles = {
    ctr1: { entryBase: [15, 40], exitBase: [10, 30], freq: 0.85, palletTypes: ['plt-euro', 'plt-industrial'] },
    ctr2: { entryBase: [5, 20],  exitBase: [3, 15],  freq: 0.75, palletTypes: ['plt-euro', 'plt-display'] },
    ctr3: { entryBase: [8, 25],  exitBase: [6, 20],  freq: 0.80, palletTypes: ['plt-display', 'plt-industrial'] },
    ctr4: { entryBase: [3, 12],  exitBase: [2, 10],  freq: 0.60, palletTypes: ['plt-euro'] },
    ctr5: { entryBase: [10, 30], exitBase: [8, 25],  freq: 0.70, palletTypes: ['plt-euro', 'plt-industrial', 'plt-display'] },
  };
  
  // Set accepted pallet types for contractors
  const contractorsWithPallets = contractors.map(c => ({
    ...c,
    acceptedPalletTypes: profiles[c.id].palletTypes
  }));
  await adapter.putMany(STORES.CONTRACTORS, contractorsWithPallets);

  const warehouseWeights = { wh1: 1.0, wh2: 0.7, wh3: 0.3, wh4: 0.15 };

  const entryNotes = ['Dostawa standardowa', 'Palety EUR', 'Towar z produkcji', 'Zwrot od klienta', 'Dostawa ekspresowa', ''];
  const exitNotes  = ['Wydanie na trasę', 'Wysyłka kurierem', 'Kompletacja zamówienia', 'Transfer magazynowy', ''];

  const inventoryRecords = [];
  const auditEntries = [];
  let recIdx = 0;
  let auditIdx = 0;

  for (const { y, m, maxDay } of months) {
    const daysInMonth = maxDay || new Date(y, m, 0).getDate();

    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(y, m - 1, d).getDay();
      if (dow === 0 || dow === 6) continue; // skip weekends

      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayTs = new Date(y, m - 1, d, 8, 0, 0).getTime();

      for (const ctr of contractors) {
        const prof = profiles[ctr.id];

        for (const [whId, weight] of Object.entries(warehouseWeights)) {
          if (rng() > prof.freq * weight) continue;

          // Generate pallet entries for IN service
          const palletEntriesIn = [];
          const numPalletTypes = prof.palletTypes.length;
          
          for (let i = 0; i < numPalletTypes; i++) {
            if (rng() > 0.7) continue; // Not all pallet types every day
            
            const palletTypeId = prof.palletTypes[i];
            const qty = prof.entryBase[0] + Math.floor(rng() * (prof.entryBase[1] - prof.entryBase[0]));
            
            if (qty > 0) {
              palletEntriesIn.push({
                palletTypeId,
                qty,
                note: entryNotes[Math.floor(rng() * entryNotes.length)],
              });
            }
          }

          // Generate pallet entries for OUT service
          const palletEntriesOut = [];
          const hasExit = rng() > 0.3;
          
          if (hasExit) {
            for (let i = 0; i < numPalletTypes; i++) {
              if (rng() > 0.6) continue;
              
              const palletTypeId = prof.palletTypes[i];
              const qty = prof.exitBase[0] + Math.floor(rng() * (prof.exitBase[1] - prof.exitBase[0]));
              
              if (qty > 0) {
                palletEntriesOut.push({
                  palletTypeId,
                  qty,
                  note: exitNotes[Math.floor(rng() * exitNotes.length)],
                });
              }
            }
          }

          const services = [];
          
          if (palletEntriesIn.length > 0) {
            services.push({
              serviceId: 'svc-pallets-in',
              palletEntries: palletEntriesIn,
              createdAt: dayTs + Math.floor(rng() * 3600000),
            });
          }
          
          if (palletEntriesOut.length > 0) {
            services.push({
              serviceId: 'svc-pallets-out',
              palletEntries: palletEntriesOut,
              createdAt: dayTs + Math.floor(rng() * 3600000),
            });
          }

          if (services.length === 0) continue;

          const recId = `demo_inv_${++recIdx}`;
          const record = {
            id: recId,
            contractorId: ctr.id,
            warehouseId: whId,
            date: dateStr,
            services,
            manuallyCompleted: true,
            createdAt: dayTs,
            updatedAt: dayTs,
            version: 1,
          };
          inventoryRecords.push(record);

          auditEntries.push({
            id: `demo_aud_${++auditIdx}`,
            timestamp: dayTs + 1000,
            userId: 'Jan Nowak',
            action: 'CREATE_INVENTORY',
            entityType: 'DailyInventory',
            entityKey: `${ctr.id}|${whId}|${dateStr}`,
            diff: {
              servicesBefore: [],
              servicesAfter: services,
            },
          });

          // ~12% of records get a second version (simulated edit)
          if (rng() < 0.12) {
            const editTs = dayTs + 4 * 3600000;
            const oldServices = JSON.parse(JSON.stringify(services));
            
            // Modify first entry if exists
            if (services.length > 0 && services[0].palletEntries && services[0].palletEntries.length > 0) {
              const delta = Math.floor(rng() * 6) - 2;
              services[0].palletEntries[0].qty = Math.max(0, services[0].palletEntries[0].qty + delta);
            }
            
            record.services = services;
            record.updatedAt = editTs;
            record.version = 2;

            auditEntries.push({
              id: `demo_aud_${++auditIdx}`,
              timestamp: editTs,
              userId: rng() > 0.5 ? 'Anna Wiśniewska' : 'Jan Nowak',
              action: 'UPDATE_INVENTORY',
              entityType: 'DailyInventory',
              entityKey: `${ctr.id}|${whId}|${dateStr}`,
              diff: {
                servicesBefore: oldServices,
                servicesAfter: services,
              },
            });
          }
        }
      }
    }
  }

  await adapter.putMany(STORES.DAILY_INVENTORY, inventoryRecords);

  // Audit entries for price changes
  const priceAudits = [
    {
      id: 'demo_aud_price1', timestamp: new Date('2026-01-28T10:00:00').getTime(),
      userId: 'Jan Nowak', action: 'ADD_PRICE', entityType: 'ServicePrice',
      entityKey: 'ctr1|svc1', diff: { effectiveFrom: '2026-02-01', pricePerUnit: 6.50 },
    },
    {
      id: 'demo_aud_price2', timestamp: new Date('2026-01-28T10:05:00').getTime(),
      userId: 'Jan Nowak', action: 'ADD_PRICE', entityType: 'ServicePrice',
      entityKey: 'ctr1|svc4', diff: { effectiveFrom: '2026-02-01', pricePerUnit: 50.00 },
    },
    {
      id: 'demo_aud_price3', timestamp: new Date('2025-12-20T14:30:00').getTime(),
      userId: 'Anna Wiśniewska', action: 'ADD_PRICE', entityType: 'ServicePrice',
      entityKey: 'ctr2|svc3', diff: { effectiveFrom: '2026-01-01', pricePerUnit: 3.00 },
    },
    {
      id: 'demo_aud_price4', timestamp: new Date('2026-01-10T09:00:00').getTime(),
      userId: 'Jan Nowak', action: 'ADD_PRICE', entityType: 'ServicePrice',
      entityKey: 'ctr5|svc3', diff: { effectiveFrom: '2026-01-15', pricePerUnit: 2.20 },
    },
    {
      id: 'demo_aud_price5', timestamp: new Date('2026-01-25T11:00:00').getTime(),
      userId: 'Anna Wiśniewska', action: 'ADD_PRICE', entityType: 'ServicePrice',
      entityKey: 'ctr3|svc4', diff: { effectiveFrom: '2026-02-01', pricePerUnit: 42.00 },
    },
  ];
  await adapter.putMany(STORES.AUDIT_LOG, [...auditEntries, ...priceAudits]);
}

// --- Service Definition Actions ---

export async function addServiceDefinition(name, unit, description = '') {
  const serviceDef = { id: generateId(), name, unit, description };
  await adapter.put(STORES.SERVICE_DEFINITIONS, serviceDef);
  setState({ serviceDefinitions: [...getState().serviceDefinitions, serviceDef] });
  return serviceDef;
}

export async function updateServiceDefinition(id, updates) {
  const serviceDefinitions = getState().serviceDefinitions.map(s =>
    s.id === id ? { ...s, ...updates } : s
  );
  const updated = serviceDefinitions.find(s => s.id === id);
  await adapter.put(STORES.SERVICE_DEFINITIONS, updated);
  setState({ serviceDefinitions });
}

// --- Database Reset ---

export async function clearAllDataAndReseed() {
  // Clear all stores
  const stores = Object.values(STORES);
  for (const storeName of stores) {
    const allRecords = await adapter.getAll(storeName);
    for (const record of allRecords) {
      // Settings store uses 'key' as keyPath, others use 'id'
      const keyToDelete = record.key || record.id;
      if (keyToDelete) {
        await adapter.delete(storeName, keyToDelete);
      }
    }
  }
  
  // Reset state
  setState({
    warehouses: [],
    contractors: [],
    serviceDefinitions: [],
    contractorServices: [],
    servicePrices: [],
    palletPrices: [],
    dailyInventory: [],
    palletTypes: [],
    auditLog: [],
  });
  
  // Reload all data (will seed initial data because contractors.length === 0)
  await loadAllData();
  await seedInitialData();
  await loadAllData();
}
