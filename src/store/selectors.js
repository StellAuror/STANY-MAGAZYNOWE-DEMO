import { getState } from './store.js';

/** Get all active contractors sorted by name */
export function getContractors() {
  return getState().contractors
    .filter(c => c.isActive)
    .sort((a, b) => a.name.localeCompare(b.name, 'pl'));
}

/** Get all warehouses sorted by sortOrder */
export function getWarehouses() {
  return getState().warehouses.sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Get active warehouse ID */
export function getActiveWarehouseId() {
  return getState().activeWarehouseId;
}

/** Get selected date */
export function getSelectedDate() {
  return getState().selectedDate;
}

/** Get active tab */
export function getActiveTab() {
  return getState().activeTab;
}

/** Get daily inventory record for contractor+warehouse+date */
export function getDailyRecord(contractorId, warehouseId, date) {
  return getState().dailyInventory.find(
    r => r.contractorId === contractorId && r.warehouseId === warehouseId && r.date === date
  ) || null;
}

/** Get all daily records for contractor+warehouse (up to a date) */
export function getDailyRecordsUpTo(contractorId, warehouseId, upToDate) {
  return getState().dailyInventory
    .filter(r =>
      r.contractorId === contractorId &&
      r.warehouseId === warehouseId &&
      r.date <= upToDate
    );
}

/** Get all daily records for a warehouse */
export function getRecordsByWarehouse(warehouseId) {
  return getState().dailyInventory.filter(r => r.warehouseId === warehouseId);
}

/** Get service definitions */
export function getServiceDefinitions() {
  return getState().serviceDefinitions;
}

/** Get pallet types */
export function getPalletTypes() {
  return getState().palletTypes;
}

/** Get contractor services for a contractor */
export function getContractorServices(contractorId) {
  return getState().contractorServices.filter(cs => cs.contractorId === contractorId);
}

/** Get enabled services for a contractor (with definitions) */
export function getEnabledServices(contractorId) {
  const cs = getContractorServices(contractorId).filter(s => s.isEnabled);
  const defs = getState().serviceDefinitions;
  
  // Map contractor services with definitions
  const services = cs.map(s => ({
    ...s,
    definition: defs.find(d => d.id === s.serviceId) || null,
  })).filter(s => s.definition);
  
  // ALWAYS include pallets-in and pallets-out services (they are mandatory)
  const mandatoryServiceIds = ['svc-pallets-in', 'svc-pallets-out'];
  
  for (const serviceId of mandatoryServiceIds) {
    // Check if service is already in the list
    if (!services.find(s => s.serviceId === serviceId)) {
      const definition = defs.find(d => d.id === serviceId);
      if (definition) {
        services.unshift({
          id: `auto-${contractorId}-${serviceId}`,
          contractorId,
          serviceId,
          isEnabled: true,
          definition,
        });
      }
    }
  }
  
  return services;
}

/** Get service prices for contractor+service, sorted by effectiveFrom */
export function getServicePrices(contractorId, serviceId) {
  return getState().servicePrices
    .filter(p => p.contractorId === contractorId && p.serviceId === serviceId)
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
}

/** Get the effective price for a contractor+service at a given date */
export function getEffectivePrice(contractorId, serviceId, date) {
  const prices = getServicePrices(contractorId, serviceId);
  let effective = null;
  for (const p of prices) {
    if (p.effectiveFrom <= date) {
      effective = p;
    }
  }
  return effective;
}

/** Get pallet prices for contractor+palletType+direction, sorted by effectiveFrom */
export function getPalletPrices(contractorId, palletTypeId, direction) {
  return getState().palletPrices
    .filter(p => p.contractorId === contractorId && p.palletTypeId === palletTypeId && p.direction === direction)
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
}

/** Get the effective price for a contractor+palletType+direction at a given date */
export function getEffectivePalletPrice(contractorId, palletTypeId, direction, date) {
  const prices = getPalletPrices(contractorId, palletTypeId, direction);
  let effective = null;
  for (const p of prices) {
    if (p.effectiveFrom <= date) {
      effective = p;
    }
  }
  return effective;
}

/** Get audit log for a specific entity */
export function getAuditForEntity(entityType, entityKey) {
  return getState().auditLog
    .filter(a => a.entityType === entityType && a.entityKey === entityKey)
    .sort((a, b) => b.timestamp - a.timestamp);
}

/** Get all audit log entries sorted by newest first */
export function getAllAuditLog() {
  return [...getState().auditLog].sort((a, b) => b.timestamp - a.timestamp);
}

/** Get modal state */
export function getModalState() {
  const s = getState();
  return {
    open: s.modalOpen,
    contractorId: s.modalContractorId,
    warehouseId: s.modalWarehouseId,
    date: s.modalDate,
  };
}

/** Get price editor state */
export function getPriceEditorState() {
  const s = getState();
  return {
    open: s.priceEditorOpen,
    contractorId: s.priceEditorContractorId,
    serviceId: s.priceEditorServiceId,
  };
}

/** Get pallet price editor state */
export function getPalletPriceEditorState() {
  const s = getState();
  return {
    open: s.palletPriceEditorOpen,
    contractorId: s.palletPriceEditorContractorId,
    palletTypeId: s.palletPriceEditorPalletTypeId,
    direction: s.palletPriceEditorDirection,
  };
}

/** Get current user name */
export function getCurrentUser() {
  return getState().currentUser;
}

/** Get selected month */
export function getSelectedMonth() {
  return getState().selectedMonth;
}

/** Get summary filters */
export function getSummaryFilters() {
  const s = getState();
  return {
    month: s.selectedMonth,
    contractorIds: s.selectedSummaryContractors,
    warehouseId: s.selectedSummaryWarehouse,
  };
}

/** Get selected contractor for detailed report */
export function getSummaryReportContractorId() {
  return getState().selectedSummaryReportContractor || null;
}

/** Find contractor by ID */
export function getContractorById(id) {
  return getState().contractors.find(c => c.id === id) || null;
}

/** Find warehouse by ID */
export function getWarehouseById(id) {
  return getState().warehouses.find(w => w.id === id) || null;
}

/** Find service definition by ID */
export function getServiceDefinitionById(id) {
  return getState().serviceDefinitions.find(s => s.id === id) || null;
}
