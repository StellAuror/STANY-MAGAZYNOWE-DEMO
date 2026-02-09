import { getDailyRecord, getDailyRecordsUpTo } from '../store/selectors.js';
import { saveDailyRecord } from '../store/actions.js';
import { generateId } from '../utils/format.js';
import { today } from '../utils/date.js';
import { auditService } from './auditService.js';
import { pricingService } from './pricingService.js';

/**
 * Calculate total stock for contractor in warehouse up to today.
 * Stan calkowity = suma wejść - wyjść for all days up to today.
 */
export function calculateTotalStock(contractorId, warehouseId) {
  const records = getDailyRecordsUpTo(contractorId, warehouseId, today());
  let total = 0;
  for (const r of records) {
    // Sum pallets from services
    if (r.services) {
      r.services.forEach(svc => {
        if (svc.serviceId === 'svc-pallets-in') {
          // Sum all pallet entries
          if (svc.palletEntries) {
            svc.palletEntries.forEach(entry => {
              total += entry.qty || 0;
            });
          }
        } else if (svc.serviceId === 'svc-pallets-out') {
          // Subtract all pallet entries
          if (svc.palletEntries) {
            svc.palletEntries.forEach(entry => {
              total -= entry.qty || 0;
            });
          }
        }
      });
    }
  }
  return total;
}

/**
 * Calculate stock per pallet type up to a specific date (inclusive).
 * Returns Map<palletTypeId, quantity>
 */
export function calculateStockByPalletType(contractorId, warehouseId, upToDate) {
  const records = getDailyRecordsUpTo(contractorId, warehouseId, upToDate);
  const stockMap = new Map();
  
  for (const r of records) {
    if (r.services) {
      r.services.forEach(svc => {
        if (svc.serviceId === 'svc-pallets-in' && svc.palletEntries) {
          svc.palletEntries.forEach(entry => {
            const current = stockMap.get(entry.palletTypeId) || 0;
            stockMap.set(entry.palletTypeId, current + (entry.qty || 0));
          });
        } else if (svc.serviceId === 'svc-pallets-out' && svc.palletEntries) {
          svc.palletEntries.forEach(entry => {
            const current = stockMap.get(entry.palletTypeId) || 0;
            stockMap.set(entry.palletTypeId, current - (entry.qty || 0));
          });
        }
      });
    }
  }
  
  return stockMap;
}

/**
 * Calculate day balance for a specific date.
 * Bilans dnia = wejścia - wyjścia dla tego dnia.
 */
export function calculateDayBalance(contractorId, warehouseId, date) {
  const record = getDailyRecord(contractorId, warehouseId, date);
  if (!record || !record.services) return 0;
  
  let palletsIn = 0;
  let palletsOut = 0;
  
  record.services.forEach(svc => {
    if (svc.serviceId === 'svc-pallets-in' && svc.palletEntries) {
      svc.palletEntries.forEach(entry => {
        palletsIn += entry.qty || 0;
      });
    } else if (svc.serviceId === 'svc-pallets-out' && svc.palletEntries) {
      svc.palletEntries.forEach(entry => {
        palletsOut += entry.qty || 0;
      });
    }
  });
  
  return palletsIn - palletsOut;
}

/**
 * Check if data has been entered for a specific day.
 * Includes manual flag for days with no movement.
 */
export function isDayCompleted(contractorId, warehouseId, date) {
  const record = getDailyRecord(contractorId, warehouseId, date);
  if (!record) return false;
  
  // Check manual completion flag
  if (record.manuallyCompleted) return true;
  
  // Check if there's any data
  if ((record.entries && record.entries.length > 0) ||
      (record.exits && record.exits.length > 0) ||
      (record.services && record.services.length > 0)) {
    return true;
  }
  
  return false;
}

/**
 * Sum qty values from entries/exits array.
 */
export function sumEntries(items) {
  if (!items || !Array.isArray(items)) return 0;
  return items.reduce((sum, item) => sum + (item.qty || 0), 0);
}

/**
 * Save or update daily inventory record.
 * Creates audit trail for changes.
 * @param {string} contractorId
 * @param {string} warehouseId
 * @param {string} date
 * @param {Array} services - array of { serviceId, qty, note }
 * @param {string} userName
 */
export async function saveInventory(contractorId, warehouseId, date, services, userName) {
  const existing = getDailyRecord(contractorId, warehouseId, date);
  const now = Date.now();

  if (existing) {
    const oldServices = existing.services || [];
    const updated = {
      ...existing,
      services: services.map(s => ({ ...s, createdAt: s.createdAt || now })),
      manuallyCompleted: true,
      updatedAt: now,
      version: (existing.version || 1) + 1,
    };

    await saveDailyRecord(updated);

    await auditService.logChange({
      userId: userName,
      action: 'UPDATE_INVENTORY',
      entityType: 'DailyInventory',
      entityKey: `${contractorId}|${warehouseId}|${date}`,
      diff: {
        servicesBefore: oldServices,
        servicesAfter: services,
      },
    });
  } else {
    const record = {
      id: generateId(),
      contractorId,
      warehouseId,
      date,
      services: services.map(s => ({ ...s, createdAt: now })),
      manuallyCompleted: true,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    await saveDailyRecord(record);

    await auditService.logChange({
      userId: userName,
      action: 'CREATE_INVENTORY',
      entityType: 'DailyInventory',
      entityKey: `${contractorId}|${warehouseId}|${date}`,
      diff: {
        servicesBefore: [],
        servicesAfter: services,
      },
    });
  }
}

/**
 * Mark a day as manually completed (for days with no movement).
 */
export async function markDayCompleted(contractorId, warehouseId, date, userName) {
  const existing = getDailyRecord(contractorId, warehouseId, date);
  const now = Date.now();

  if (existing) {
    const updated = {
      ...existing,
      manuallyCompleted: true,
      updatedAt: now,
    };
    await saveDailyRecord(updated);
  } else {
    const record = {
      id: generateId(),
      contractorId,
      warehouseId,
      date,
      services: [],
      manuallyCompleted: true,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
    await saveDailyRecord(record);
  }

  await auditService.logChange({
    userId: userName,
    action: 'MARK_DAY_COMPLETED',
    entityType: 'DailyInventory',
    entityKey: `${contractorId}|${warehouseId}|${date}`,
    diff: { manuallyCompleted: true },
  });
}

/**
 * Get all versions (history) for a daily record.
 * Since we overwrite the record, history is tracked in the audit log.
 */
export function getRecordHistory(contractorId, warehouseId, date) {
  return auditService.getEntityAudit(
    'DailyInventory',
    `${contractorId}|${warehouseId}|${date}`
  );
}

/**
 * Calculate revenue from day operations (pallets in/out).
 * Returns total revenue from svc-pallets-in and svc-pallets-out services.
 */
export function calculateDayRevenue(contractorId, warehouseId, date) {
  const record = getDailyRecord(contractorId, warehouseId, date);
  if (!record || !record.services) return 0;
  
  let revenue = 0;
  
  for (const svc of record.services) {
    if (svc.serviceId === 'svc-pallets-in' || svc.serviceId === 'svc-pallets-out') {
      const price = pricingService.getPriceAtDate(contractorId, svc.serviceId, date);
      // Sum all pallet entries
      if (svc.palletEntries) {
        svc.palletEntries.forEach(entry => {
          revenue += (entry.qty || 0) * price;
        });
      }
    }
  }
  
  return revenue;
}

/**
 * Calculate revenue from storage (when no movement - charged for stock on warehouse).
 * Returns revenue from svc-storage service.
 */
export function calculateStorageRevenue(contractorId, warehouseId, date) {
  const record = getDailyRecord(contractorId, warehouseId, date);
  if (!record) return 0;
  
  // Check if there are any movements
  const hasMovement = record.services && record.services.some(s => 
    (s.serviceId === 'svc-pallets-in' || s.serviceId === 'svc-pallets-out') && s.qty > 0
  );
  
  if (hasMovement) return 0; // If there are movements, no storage charge
  
  // Calculate storage charge based on current stock
  const stock = calculateTotalStock(contractorId, warehouseId);
  if (stock <= 0) return 0;
  
  const price = pricingService.getPriceAtDate(contractorId, 'svc-storage', date);
  
  return stock * price;
}

/**
 * Calculate revenue from additional services (all services except pallets and storage).
 */
export function calculateAdditionalServicesRevenue(contractorId, warehouseId, date) {
  const record = getDailyRecord(contractorId, warehouseId, date);
  if (!record || !record.services) return 0;
  
  let revenue = 0;
  
  for (const svc of record.services) {
    if (svc.serviceId !== 'svc-pallets-in' && 
        svc.serviceId !== 'svc-pallets-out' && 
        svc.serviceId !== 'svc-storage') {
      const price = pricingService.getPriceAtDate(contractorId, svc.serviceId, date);
      revenue += (svc.qty || 0) * price;
    }
  }
  
  return revenue;
}

/**
 * Calculate average stock over last 30 days.
 */
export function calculateAverage30DayStock(contractorId, warehouseId, date) {
  const dateObj = new Date(date);
  const startDate = new Date(dateObj.getTime() - 30 * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);
  
  // Get all records from the beginning
  const allRecords = getDailyRecordsUpTo(contractorId, warehouseId, date);
  
  // Calculate cumulative stock at each date
  let runningStock = 0;
  let totalStock = 0;
  let daysCount = 0;
  
  // Sort by date
  const sortedRecords = [...allRecords].sort((a, b) => a.date.localeCompare(b.date));
  
  // Build a map of daily stock values
  const stockByDate = new Map();
  
  for (const record of sortedRecords) {
    // Calculate change for this day
    if (record.services) {
      for (const svc of record.services) {
        if (svc.serviceId === 'svc-pallets-in') {
          runningStock += svc.qty || 0;
        } else if (svc.serviceId === 'svc-pallets-out') {
          runningStock -= svc.qty || 0;
        }
      }
    }
    stockByDate.set(record.date, runningStock);
  }
  
  // Calculate average for last 30 days
  for (let d = new Date(startDate); d <= dateObj; d.setDate(d.getDate() + 1)) {
    const dayStr = d.toISOString().slice(0, 10);
    
    // Find the stock at this date (use the most recent known value)
    let stockAtDate = 0;
    for (const [recordDate, stock] of stockByDate.entries()) {
      if (recordDate <= dayStr) {
        stockAtDate = stock;
      }
    }
    
    totalStock += stockAtDate;
    daysCount++;
  }
  
  return daysCount > 0 ? totalStock / daysCount : 0;
}
