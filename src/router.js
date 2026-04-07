import { getActiveTab } from './store/selectors.js';
import { ContractorsTable } from './components/ContractorsTable.js';
import { ContractorServices } from './components/ContractorServices.js';
import { PalletTypesManager } from './components/PalletTypesManager.js';
import { MonthlySummary } from './components/MonthlySummary.js';
import { AuditLogViewer } from './components/AuditLogViewer.js';
import { WarehousesManager } from './components/WarehousesManager.js';
import { KpiTable } from './components/KpiTable.js';

/**
 * Returns the component for the active tab.
 * @returns {HTMLElement}
 */
export function getActiveView() {
  const tab = getActiveTab();

  switch (tab) {
    case 'inventory':
      return ContractorsTable();
    case 'kpi':
      return KpiTable();
    case 'contractor':
      return ContractorServices();
    case 'pallets':
      return PalletTypesManager();
    case 'summary':
      return MonthlySummary();
    case 'warehouses':
      return WarehousesManager();
    case 'audit':
      return AuditLogViewer();
    default:
      return ContractorsTable();
  }
}
