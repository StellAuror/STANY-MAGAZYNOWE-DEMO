import { STORES } from './dataAdapter.js';

const DB_NAME = 'MAGAZYN_DB';
const DB_VERSION = 4;

/** @type {IDBDatabase|null} */
let db = null;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const database = e.target.result;

      // Warehouses
      if (!database.objectStoreNames.contains(STORES.WAREHOUSES)) {
        database.createObjectStore(STORES.WAREHOUSES, { keyPath: 'id' });
      }

      // Contractors
      if (!database.objectStoreNames.contains(STORES.CONTRACTORS)) {
        database.createObjectStore(STORES.CONTRACTORS, { keyPath: 'id' });
      }

      // Service definitions
      if (!database.objectStoreNames.contains(STORES.SERVICE_DEFINITIONS)) {
        database.createObjectStore(STORES.SERVICE_DEFINITIONS, { keyPath: 'id' });
      }

      // Contractor-service assignments
      if (!database.objectStoreNames.contains(STORES.CONTRACTOR_SERVICES)) {
        const cs = database.createObjectStore(STORES.CONTRACTOR_SERVICES, { keyPath: 'id' });
        cs.createIndex('byContractor', 'contractorId', { unique: false });
        cs.createIndex('byService', 'serviceId', { unique: false });
      }

      // Service prices
      if (!database.objectStoreNames.contains(STORES.SERVICE_PRICES)) {
        const sp = database.createObjectStore(STORES.SERVICE_PRICES, { keyPath: 'id' });
        sp.createIndex('byContractorService', ['contractorId', 'serviceId'], { unique: false });
      }

      // Pallet prices (for pallet type in/out pricing)
      if (!database.objectStoreNames.contains(STORES.PALLET_PRICES)) {
        const pp = database.createObjectStore(STORES.PALLET_PRICES, { keyPath: 'id' });
        pp.createIndex('byContractorPalletType', ['contractorId', 'palletTypeId', 'direction'], { unique: false });
      }

      // Daily inventory records
      if (!database.objectStoreNames.contains(STORES.DAILY_INVENTORY)) {
        const di = database.createObjectStore(STORES.DAILY_INVENTORY, { keyPath: 'id' });
        di.createIndex('byContractorWarehouse', ['contractorId', 'warehouseId'], { unique: false });
        di.createIndex('byContractorWarehouseDate', ['contractorId', 'warehouseId', 'date'], { unique: false });
        di.createIndex('byWarehouse', 'warehouseId', { unique: false });
        di.createIndex('byDate', 'date', { unique: false });
      }

      // Pallet types
      if (!database.objectStoreNames.contains(STORES.PALLET_TYPES)) {
        database.createObjectStore(STORES.PALLET_TYPES, { keyPath: 'id' });
      }

      // Audit log
      if (!database.objectStoreNames.contains(STORES.AUDIT_LOG)) {
        const al = database.createObjectStore(STORES.AUDIT_LOG, { keyPath: 'id' });
        al.createIndex('byEntity', ['entityType', 'entityKey'], { unique: false });
        al.createIndex('byTimestamp', 'timestamp', { unique: false });
      }

      // Settings
      if (!database.objectStoreNames.contains(STORES.SETTINGS)) {
        database.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }

      // KPI definitions (global catalog)
      if (!database.objectStoreNames.contains(STORES.KPI_DEFINITIONS)) {
        database.createObjectStore(STORES.KPI_DEFINITIONS, { keyPath: 'id' });
      }

      // Warehouse-KPI assignments (which KPIs are active for a warehouse)
      if (!database.objectStoreNames.contains(STORES.WAREHOUSE_KPIS)) {
        const wk = database.createObjectStore(STORES.WAREHOUSE_KPIS, { keyPath: 'id' });
        wk.createIndex('byWarehouse', 'warehouseId', { unique: false });
        wk.createIndex('byKpi', 'kpiId', { unique: false });
      }

      // Daily KPI values
      if (!database.objectStoreNames.contains(STORES.KPI_VALUES)) {
        const kv = database.createObjectStore(STORES.KPI_VALUES, { keyPath: 'id' });
        kv.createIndex('byWarehouseKpiDate', ['warehouseId', 'kpiId', 'date'], { unique: false });
        kv.createIndex('byWarehouse', 'warehouseId', { unique: false });
        kv.createIndex('byDate', 'date', { unique: false });
      }
    };

    request.onsuccess = (e) => {
      resolve(e.target.result);
    };

    request.onerror = (e) => {
      reject(e.target.error);
    };
  });
}

function tx(storeName, mode = 'readonly') {
  const transaction = db.transaction(storeName, mode);
  return transaction.objectStore(storeName);
}

function reqToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** @type {import('./dataAdapter.js').DataAdapter} */
const indexedDbAdapter = {
  async init() {
    db = await openDb();
  },

  async getAll(storeName) {
    return reqToPromise(tx(storeName).getAll());
  },

  async get(storeName, key) {
    return reqToPromise(tx(storeName).get(key));
  },

  async put(storeName, item) {
    return reqToPromise(tx(storeName, 'readwrite').put(item));
  },

  async delete(storeName, key) {
    return reqToPromise(tx(storeName, 'readwrite').delete(key));
  },

  async putMany(storeName, items) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      for (const item of items) {
        store.put(item);
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  },

  async getByIndex(storeName, indexName, query) {
    const store = tx(storeName);
    const index = store.index(indexName);
    return reqToPromise(index.getAll(query));
  },

  async getByRange(storeName, indexName, range) {
    const store = tx(storeName);
    const index = store.index(indexName);
    return reqToPromise(index.getAll(range));
  },
};

export default indexedDbAdapter;
