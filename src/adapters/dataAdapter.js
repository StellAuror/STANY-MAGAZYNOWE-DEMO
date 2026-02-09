/**
 * DataAdapter interface definition.
 * Any adapter must implement these methods.
 * All methods are async for future backend compatibility.
 */

/**
 * @typedef {Object} DataAdapter
 * @property {() => Promise<void>} init
 * @property {(storeName: string) => Promise<Array>} getAll
 * @property {(storeName: string, key: string) => Promise<any>} get
 * @property {(storeName: string, item: any) => Promise<void>} put
 * @property {(storeName: string, key: string) => Promise<void>} delete
 * @property {(storeName: string, indexName: string, query: any) => Promise<Array>} getByIndex
 * @property {(storeName: string, indexName: string, range: IDBKeyRange) => Promise<Array>} getByRange
 */

/** Store names (constants) */
export const STORES = {
  WAREHOUSES: 'warehouses',
  CONTRACTORS: 'contractors',
  SERVICE_DEFINITIONS: 'serviceDefinitions',
  CONTRACTOR_SERVICES: 'contractorServices',
  SERVICE_PRICES: 'servicePrices',
  PALLET_PRICES: 'palletPrices',
  DAILY_INVENTORY: 'dailyInventory',
  PALLET_TYPES: 'palletTypes',
  AUDIT_LOG: 'auditLog',
  SETTINGS: 'settings',
};
