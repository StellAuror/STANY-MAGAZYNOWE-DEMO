import { getState } from '../store/store.js';
import { getEnabledServices, getContractorById } from '../store/selectors.js';
import { getDaysInMonth } from '../utils/date.js';
import { pricingService } from './pricingService.js';
import { sumEntries } from './inventoryService.js';

/**
 * Generate monthly summary for given filters.
 * @param {string} month - "YYYY-MM"
 * @param {string[]} contractorIds
 * @param {string} warehouseId - 'all' or specific warehouse ID
 */
export function getMonthlySummary(month, contractorIds, warehouseId) {
  const days = getDaysInMonth(month);
  const state = getState();
  const results = [];

  for (const contractorId of contractorIds) {
    const contractor = getContractorById(contractorId);
    if (!contractor) continue;

    const enabledServices = getEnabledServices(contractorId);
    const contractorResult = {
      contractorId,
      contractorName: contractor.name,
      services: [],
      totalRevenue: 0,
      totalCost: 0,
    };

    for (const svc of enabledServices) {
      const serviceId = svc.serviceId;
      const def = svc.definition;

      // Sum quantities across all days and relevant warehouses
      let totalQty = 0;
      let totalRevenue = 0;

      for (const day of days) {
        // Get records for this day
        const dayRecords = state.dailyInventory.filter(r => {
          if (r.contractorId !== contractorId || r.date !== day) return false;
          if (warehouseId !== 'all' && r.warehouseId !== warehouseId) return false;
          return true;
        });

        // Sum pallet entries for the day
        let dayQty = 0;
        for (const rec of dayRecords) {
          if (!rec.services) continue;
          for (const svcEntry of rec.services) {
            if (svcEntry.serviceId !== serviceId) continue;
            if (svcEntry.palletEntries) {
              for (const pe of svcEntry.palletEntries) {
                dayQty += pe.qty || 0;
              }
            }
          }
        }

        if (dayQty > 0) {
          const pricePerUnit = pricingService.getPriceAtDate(contractorId, serviceId, day);
          totalQty += dayQty;
          totalRevenue += dayQty * pricePerUnit;
        }
      }

      contractorResult.services.push({
        serviceId,
        serviceName: def.name,
        unit: def.unit,
        quantity: totalQty,
        revenue: Math.round(totalRevenue * 100) / 100,
        cost: 0, // placeholder for MVP
      });

      contractorResult.totalRevenue += Math.round(totalRevenue * 100) / 100;
    }

    results.push(contractorResult);
  }

  return results;
}

/**
 * Get daily revenue data for chart.
 * Returns array of { date, revenue, cost } for each day in the month.
 */
export function getDailyChartData(month, contractorIds, warehouseId) {
  const days = getDaysInMonth(month);
  const state = getState();
  const data = [];

  for (const day of days) {
    let dayRevenue = 0;
    let dayCost = 0;

    for (const contractorId of contractorIds) {
      const enabledServices = getEnabledServices(contractorId);

      const dayRecords = state.dailyInventory.filter(r => {
        if (r.contractorId !== contractorId || r.date !== day) return false;
        if (warehouseId !== 'all' && r.warehouseId !== warehouseId) return false;
        return true;
      });

      for (const svc of enabledServices) {
        let dayQtyForService = 0;
        
        for (const rec of dayRecords) {
          if (!rec.services) continue;
          for (const svcEntry of rec.services) {
            if (svcEntry.serviceId !== svc.serviceId) continue;
            if (svcEntry.palletEntries) {
              for (const pe of svcEntry.palletEntries) {
                dayQtyForService += pe.qty || 0;
              }
            }
          }
        }

        if (dayQtyForService > 0) {
          const pricePerUnit = pricingService.getPriceAtDate(contractorId, svc.serviceId, day);
          dayRevenue += dayQtyForService * pricePerUnit;
        }
      }
    }

    data.push({
      date: day,
      label: day.slice(8), // day number
      revenue: Math.round(dayRevenue * 100) / 100,
      cost: Math.round(dayCost * 100) / 100,
    });
  }

  return data;
}
