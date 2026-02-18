import { getState } from '../store/store.js';
import { getEnabledServices, getContractorById, getContractors } from '../store/selectors.js';
import { getDaysInMonth } from '../utils/date.js';
import { pricingService } from './pricingService.js';
import { sumEntries, calculateTotalStock, calculateStockByPalletType } from './inventoryService.js';

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
 * Returns array of { date, revenue } for each day in the month.
 * Includes: pallet movements, additional services (VASY + Transport), storage.
 */
export function getDailyChartData(month, contractorIds, warehouseId) {
  const days = getDaysInMonth(month);
  const state = getState();
  const warehouses = state.warehouses;
  const data = [];

  for (const day of days) {
    let dayRevenue = 0;

    for (const contractorId of contractorIds) {
      const dayRecords = state.dailyInventory.filter(r => {
        if (r.contractorId !== contractorId || r.date !== day) return false;
        if (warehouseId !== 'all' && r.warehouseId !== warehouseId) return false;
        return true;
      });

      const warehousesWithMovement = new Set();

      for (const rec of dayRecords) {
        if (!rec.services) continue;
        let hasMovement = false;

        for (const svc of rec.services) {
          if (svc.serviceId === 'svc-pallets-in' || svc.serviceId === 'svc-pallets-out') {
            if (svc.palletEntries) {
              for (const pe of svc.palletEntries) {
                const qty = pe.qty || 0;
                if (qty > 0) {
                  hasMovement = true;
                  // Movement price always uses 'in' slot
                  const palletPrice = pricingService.getPalletPriceAtDate(contractorId, pe.palletTypeId, 'in', day);
                  const fallbackPrice = pricingService.getPriceAtDate(contractorId, svc.serviceId, day);
                  const price = palletPrice > 0 ? palletPrice : fallbackPrice;
                  dayRevenue += qty * price;
                }
              }
            }
          } else if (svc.serviceId === 'svc-pallets-correction') {
            // Corrections: manual price stored per entry
            if (svc.palletEntries) {
              for (const pe of svc.palletEntries) {
                const qty = pe.qty || 0;
                const manualPrice = pe.manualPrice || 0;
                if (qty !== 0) dayRevenue += Math.abs(qty) * manualPrice;
              }
            }
          } else if (svc.serviceId !== 'svc-storage') {
            // Additional services: VASY + Transport
            const qty = svc.qty || 0;
            if (qty > 0) {
              const price = pricingService.getPriceAtDate(contractorId, svc.serviceId, day);
              dayRevenue += qty * price;
            }
          }
        }

        if (hasMovement) warehousesWithMovement.add(rec.warehouseId);
      }

      // Storage revenue per pallet type — uses 'out' price slot
      const whList = warehouseId !== 'all' ? [warehouseId] : warehouses.map(w => w.id);
      for (const whId of whList) {
        if (warehousesWithMovement.has(whId)) continue;
        const stockMap = calculateStockByPalletType(contractorId, whId, day);
        for (const [ptId, qty] of stockMap) {
          if (qty <= 0) continue;
          const storagePrice = pricingService.getPalletPriceAtDate(contractorId, ptId, 'out', day)
            || pricingService.getPriceAtDate(contractorId, 'svc-storage', day);
          dayRevenue += qty * storagePrice;
        }
      }
    }

    data.push({
      date: day,
      label: day.slice(8),
      revenue: Math.round(dayRevenue * 100) / 100,
      cost: 0,
    });
  }

  return data;
}

/**
 * Get TOP 5 contractors by total revenue with breakdown.
 * Categories: movement (pallets in/out), additional services, storage.
 * @param {string} month - "YYYY-MM"
 * @param {string} warehouseId - 'all' or specific warehouse ID
 */
export function getTop5ByRevenue(month, warehouseId) {
  const days = getDaysInMonth(month);
  const state = getState();
  const allContractors = getContractors();
  const warehouses = state.warehouses;

  const results = [];

  for (const contractor of allContractors) {
    let movementRevenue = 0;
    let additionalRevenue = 0;
    let storageRevenue = 0;

    for (const day of days) {
      const dayRecords = state.dailyInventory.filter(r => {
        if (r.contractorId !== contractor.id || r.date !== day) return false;
        if (warehouseId !== 'all' && r.warehouseId !== warehouseId) return false;
        return true;
      });

      // Track which warehouses have movement this day
      const warehousesWithMovement = new Set();

      for (const rec of dayRecords) {
        if (!rec.services) continue;

        let hasMovement = false;

        for (const svc of rec.services) {
          if (svc.serviceId === 'svc-pallets-in' || svc.serviceId === 'svc-pallets-out') {
            // Movement revenue — always uses 'in' price slot
            if (svc.palletEntries) {
              for (const pe of svc.palletEntries) {
                const qty = pe.qty || 0;
                if (qty > 0) {
                  hasMovement = true;
                  const palletPrice = pricingService.getPalletPriceAtDate(contractor.id, pe.palletTypeId, 'in', day);
                  const fallbackPrice = pricingService.getPriceAtDate(contractor.id, svc.serviceId, day);
                  const price = palletPrice > 0 ? palletPrice : fallbackPrice;
                  movementRevenue += qty * price;
                }
              }
            }
          } else if (svc.serviceId === 'svc-pallets-correction') {
            // Corrections: manual price per entry
            if (svc.palletEntries) {
              for (const pe of svc.palletEntries) {
                const qty = pe.qty || 0;
                const manualPrice = pe.manualPrice || 0;
                if (qty !== 0) movementRevenue += Math.abs(qty) * manualPrice;
              }
            }
          } else if (svc.serviceId !== 'svc-storage') {
            // Additional services
            const qty = svc.qty || 0;
            if (qty > 0) {
              const price = pricingService.getPriceAtDate(contractor.id, svc.serviceId, day);
              additionalRevenue += qty * price;
            }
          }
        }

        if (hasMovement) {
          warehousesWithMovement.add(rec.warehouseId);
        }
      }

      // Storage revenue per pallet type — uses 'out' price slot
      const whList = warehouseId !== 'all' ? [warehouseId] : warehouses.map(w => w.id);
      for (const whId of whList) {
        if (warehousesWithMovement.has(whId)) continue;
        const stockMap = calculateStockByPalletType(contractor.id, whId, day);
        for (const [ptId, qty] of stockMap) {
          if (qty <= 0) continue;
          const storagePrice = pricingService.getPalletPriceAtDate(contractor.id, ptId, 'out', day)
            || pricingService.getPriceAtDate(contractor.id, 'svc-storage', day);
          storageRevenue += qty * storagePrice;
        }
      }
    }

    const totalRevenue = movementRevenue + additionalRevenue + storageRevenue;

    results.push({
      contractorId: contractor.id,
      contractorName: contractor.name,
      movementRevenue: Math.round(movementRevenue * 100) / 100,
      additionalRevenue: Math.round(additionalRevenue * 100) / 100,
      storageRevenue: Math.round(storageRevenue * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
    });
  }

  // Sort descending by total revenue
  results.sort((a, b) => b.totalRevenue - a.totalRevenue);

  return results.slice(0, 5);
}

/**
 * Get per-day billing breakdown for a single contractor in a given month.
 * Returns array of day objects with itemized charges and daily total.
 */
export function getContractorDailyReport(month, contractorId, warehouseId) {
  const days = getDaysInMonth(month);
  const state = getState();
  const warehouses = state.warehouses;
  const report = [];

  for (const day of days) {
    const lines = [];

    const dayRecords = state.dailyInventory.filter(r => {
      if (r.contractorId !== contractorId || r.date !== day) return false;
      if (warehouseId !== 'all' && r.warehouseId !== warehouseId) return false;
      return true;
    });

    const warehousesWithMovement = new Set();

    for (const rec of dayRecords) {
      if (!rec.services) continue;
      let hasMovement = false;

      for (const svc of rec.services) {
        if (svc.serviceId === 'svc-pallets-in' || svc.serviceId === 'svc-pallets-out') {
          if (svc.palletEntries) {
            const label = svc.serviceId === 'svc-pallets-in' ? 'Wejście palet' : 'Wyjście palet';
            for (const pe of svc.palletEntries) {
              const qty = pe.qty || 0;
              if (qty > 0) {
                hasMovement = true;
                // Movement always uses 'in' price slot
                const palletPrice = pricingService.getPalletPriceAtDate(contractorId, pe.palletTypeId, 'in', day);
                const fallbackPrice = pricingService.getPriceAtDate(contractorId, svc.serviceId, day);
                const price = palletPrice > 0 ? palletPrice : fallbackPrice;
                const total = Math.round(qty * price * 100) / 100;
                const pt = state.palletTypes?.find(p => p.id === pe.palletTypeId);
                lines.push({
                  category: 'Ruchy magazynowe',
                  name: `${label}${pt ? ' — ' + pt.name : ''}`,
                  qty,
                  unit: 'szt',
                  price,
                  total,
                });
              }
            }
          }
        } else if (svc.serviceId === 'svc-pallets-correction') {
          // Corrections with manual price
          if (svc.palletEntries) {
            for (const pe of svc.palletEntries) {
              const qty = pe.qty || 0;
              const manualPrice = pe.manualPrice || 0;
              if (qty !== 0) {
                const total = Math.round(Math.abs(qty) * manualPrice * 100) / 100;
                const pt = state.palletTypes?.find(p => p.id === pe.palletTypeId);
                lines.push({
                  category: 'Ruchy magazynowe',
                  name: `Korekta${pt ? ' — ' + pt.name : ''}`,
                  qty,
                  unit: 'szt',
                  price: manualPrice,
                  total,
                });
              }
            }
          }
        } else if (svc.serviceId !== 'svc-storage') {
          const qty = svc.qty || 0;
          if (qty > 0) {
            const price = pricingService.getPriceAtDate(contractorId, svc.serviceId, day);
            const total = Math.round(qty * price * 100) / 100;
            const enabledSvc = getEnabledServices(contractorId).find(s => s.serviceId === svc.serviceId);
            const name = enabledSvc?.definition?.name || svc.serviceId;
            const isTransport = /transport/i.test(name);
            lines.push({
              category: isTransport ? 'Transport' : 'VASY',
              name,
              qty,
              unit: enabledSvc?.definition?.unit || 'szt',
              price,
              total,
            });
          }
        }
      }

      if (hasMovement) warehousesWithMovement.add(rec.warehouseId);
    }

    // Storage per pallet type — uses 'out' price slot
    const whList = warehouseId !== 'all' ? [warehouseId] : warehouses.map(w => w.id);
    for (const whId of whList) {
      if (warehousesWithMovement.has(whId)) continue;
      const stockMap = calculateStockByPalletType(contractorId, whId, day);
      for (const [ptId, qty] of stockMap) {
        if (qty <= 0) continue;
        const storagePrice = pricingService.getPalletPriceAtDate(contractorId, ptId, 'out', day)
          || pricingService.getPriceAtDate(contractorId, 'svc-storage', day);
        const total = Math.round(qty * storagePrice * 100) / 100;
        const pt = state.palletTypes?.find(p => p.id === ptId);
        lines.push({
          category: 'Stan magazynowy',
          name: `Magazynowanie${pt ? ' — ' + pt.name : ''}`,
          qty,
          unit: 'szt',
          price: storagePrice,
          total,
        });
      }
    }

    const dayTotal = lines.reduce((s, l) => s + l.total, 0);
    report.push({ date: day, lines, dayTotal: Math.round(dayTotal * 100) / 100 });
  }

  return report;
}

/**
 * Get TOP 5 contractors by Month-over-Month growth (%).
 * @param {string} month - "YYYY-MM" (current month)
 * @param {string} warehouseId - 'all' or specific warehouse ID
 */
export function getTop5MoMGrowth(month, warehouseId) {
  const allContractors = getContractors();

  // Calculate previous month string
  const [y, m] = month.split('-').map(Number);
  const prevDate = new Date(y, m - 2, 1); // month is 1-based, Date month is 0-based
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  /**
   * Calculate total revenue for a contractor in a given month.
   */
  function calcMonthRevenue(contractorId, monthStr) {
    const days = getDaysInMonth(monthStr);
    const state = getState();
    let revenue = 0;

    for (const day of days) {
      const dayRecords = state.dailyInventory.filter(r => {
        if (r.contractorId !== contractorId || r.date !== day) return false;
        if (warehouseId !== 'all' && r.warehouseId !== warehouseId) return false;
        return true;
      });

      for (const rec of dayRecords) {
        if (!rec.services) continue;
        for (const svc of rec.services) {
          if (svc.serviceId === 'svc-pallets-in' || svc.serviceId === 'svc-pallets-out') {
            if (svc.palletEntries) {
              for (const pe of svc.palletEntries) {
                const qty = pe.qty || 0;
                if (qty > 0) {
                  // Movement always uses 'in' price slot
                  const palletPrice = pricingService.getPalletPriceAtDate(contractorId, pe.palletTypeId, 'in', day);
                  const fallbackPrice = pricingService.getPriceAtDate(contractorId, svc.serviceId, day);
                  const price = palletPrice > 0 ? palletPrice : fallbackPrice;
                  revenue += qty * price;
                }
              }
            }
          } else if (svc.serviceId === 'svc-pallets-correction') {
            if (svc.palletEntries) {
              for (const pe of svc.palletEntries) {
                const qty = pe.qty || 0;
                const manualPrice = pe.manualPrice || 0;
                if (qty !== 0) revenue += Math.abs(qty) * manualPrice;
              }
            }
          } else if (svc.serviceId !== 'svc-storage') {
            const qty = svc.qty || 0;
            if (qty > 0) {
              const price = pricingService.getPriceAtDate(contractorId, svc.serviceId, day);
              revenue += qty * price;
            }
          }
        }
      }
    }

    return Math.round(revenue * 100) / 100;
  }

  const results = [];

  for (const contractor of allContractors) {
    const currentRevenue = calcMonthRevenue(contractor.id, month);
    const previousRevenue = calcMonthRevenue(contractor.id, prevMonth);

    let momPercent = null;
    let isNew = false;

    if (previousRevenue === 0 && currentRevenue > 0) {
      momPercent = Infinity;
      isNew = true;
    } else if (previousRevenue === 0 && currentRevenue === 0) {
      momPercent = 0;
    } else {
      momPercent = ((currentRevenue - previousRevenue) / previousRevenue) * 100;
    }

    results.push({
      contractorId: contractor.id,
      contractorName: contractor.name,
      currentRevenue,
      previousRevenue,
      momPercent: momPercent === Infinity ? Infinity : Math.round(momPercent * 10) / 10,
      isNew,
    });
  }

  // Sort descending by MoM % (Infinity = new clients first)
  results.sort((a, b) => {
    if (a.momPercent === Infinity && b.momPercent === Infinity) return b.currentRevenue - a.currentRevenue;
    if (a.momPercent === Infinity) return -1;
    if (b.momPercent === Infinity) return 1;
    return b.momPercent - a.momPercent;
  });

  return results.slice(0, 5);
}
