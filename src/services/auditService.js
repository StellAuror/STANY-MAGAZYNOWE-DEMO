import { addAuditEntry } from '../store/actions.js';
import { getAuditForEntity } from '../store/selectors.js';

export const auditService = {
  /**
   * Log a change event.
   * @param {Object} params
   * @param {string} params.userId
   * @param {string} params.action
   * @param {string} params.entityType
   * @param {string} params.entityKey
   * @param {Object} params.diff
   */
  async logChange({ userId, action, entityType, entityKey, diff }) {
    await addAuditEntry({
      timestamp: Date.now(),
      userId,
      action,
      entityType,
      entityKey,
      diff,
    });
  },

  /**
   * Get audit entries for a specific entity.
   */
  getEntityAudit(entityType, entityKey) {
    return getAuditForEntity(entityType, entityKey);
  },
};
