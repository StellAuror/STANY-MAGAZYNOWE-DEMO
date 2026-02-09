import { getServicePrices, getEffectivePrice, getPalletPrices, getEffectivePalletPrice } from '../store/selectors.js';
import { addServicePrice, updateServicePrice, addPalletPrice, updatePalletPrice } from '../store/actions.js';
import { auditService } from './auditService.js';

export const pricingService = {
  /**
   * Get all price records for contractor+service.
   */
  getPriceHistory(contractorId, serviceId) {
    return getServicePrices(contractorId, serviceId);
  },

  /**
   * Get effective price per unit at a given date.
   * Returns the pricePerUnit or 0 if no price is defined.
   */
  getPriceAtDate(contractorId, serviceId, date) {
    const priceRecord = getEffectivePrice(contractorId, serviceId, date);
    return priceRecord ? priceRecord.pricePerUnit : 0;
  },

  /**
   * Add a new price entry (new rate from a given date).
   */
  async addPrice(contractorId, serviceId, effectiveFrom, pricePerUnit, userName) {
    const record = await addServicePrice({
      contractorId,
      serviceId,
      effectiveFrom,
      pricePerUnit,
    });

    await auditService.logChange({
      userId: userName,
      action: 'ADD_PRICE',
      entityType: 'ServicePrice',
      entityKey: `${contractorId}|${serviceId}`,
      diff: {
        effectiveFrom,
        pricePerUnit,
      },
    });

    return record;
  },

  /**
   * Update an existing price entry.
   */
  async updatePrice(priceId, updates, userName) {
    const prices = getServicePrices(updates.contractorId || '', updates.serviceId || '');
    const old = prices.find(p => p.id === priceId);

    await updateServicePrice(priceId, updates);

    await auditService.logChange({
      userId: userName,
      action: 'UPDATE_PRICE',
      entityType: 'ServicePrice',
      entityKey: `${old?.contractorId}|${old?.serviceId}`,
      diff: {
        before: old ? { effectiveFrom: old.effectiveFrom, pricePerUnit: old.pricePerUnit } : null,
        after: updates,
      },
    });
  },

  /**
   * Get all pallet price records for contractor+palletType+direction.
   */
  getPalletPriceHistory(contractorId, palletTypeId, direction) {
    return getPalletPrices(contractorId, palletTypeId, direction);
  },

  /**
   * Get effective pallet price per unit at a given date.
   * Returns the pricePerUnit or 0 if no price is defined.
   */
  getPalletPriceAtDate(contractorId, palletTypeId, direction, date) {
    const priceRecord = getEffectivePalletPrice(contractorId, palletTypeId, direction, date);
    return priceRecord ? priceRecord.pricePerUnit : 0;
  },

  /**
   * Add a new pallet price entry (new rate from a given date).
   */
  async addPalletPrice(contractorId, palletTypeId, direction, effectiveFrom, pricePerUnit, userName) {
    const record = await addPalletPrice({
      contractorId,
      palletTypeId,
      direction,
      effectiveFrom,
      pricePerUnit,
    });

    await auditService.logChange({
      userId: userName,
      action: 'ADD_PALLET_PRICE',
      entityType: 'PalletPrice',
      entityKey: `${contractorId}|${palletTypeId}|${direction}`,
      diff: {
        effectiveFrom,
        pricePerUnit,
      },
    });

    return record;
  },

  /**
   * Update an existing pallet price entry.
   */
  async updatePalletPrice(priceId, updates, userName) {
    const prices = getPalletPrices(updates.contractorId || '', updates.palletTypeId || '', updates.direction || 'in');
    const old = prices.find(p => p.id === priceId);

    await updatePalletPrice(priceId, updates);

    await auditService.logChange({
      userId: userName,
      action: 'UPDATE_PALLET_PRICE',
      entityType: 'PalletPrice',
      entityKey: `${old?.contractorId}|${old?.palletTypeId}|${old?.direction}`,
      diff: {
        before: old ? { effectiveFrom: old.effectiveFrom, pricePerUnit: old.pricePerUnit } : null,
        after: updates,
      },
    });
  },
};
