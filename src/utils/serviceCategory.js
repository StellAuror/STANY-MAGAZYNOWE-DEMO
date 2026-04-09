export const SERVICE_CATEGORIES = {
  TRANSPORT: 'TRANSPORT',
  VASY: 'VASY',
  SYSTEM: 'SYSTEM',
};

const SYSTEM_SERVICE_IDS = new Set(['svc-pallets-in', 'svc-pallets-out', 'svc-pallets-correction', 'svc-storage']);

export function normalizeServiceCategory(value, name = '') {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === SERVICE_CATEGORIES.TRANSPORT) return SERVICE_CATEGORIES.TRANSPORT;
  if (normalized === SERVICE_CATEGORIES.VASY) return SERVICE_CATEGORIES.VASY;
  if (normalized === SERVICE_CATEGORIES.SYSTEM) return SERVICE_CATEGORIES.SYSTEM;

  // Backward compatibility for legacy records without explicit category.
  return /transport/i.test(String(name || ''))
    ? SERVICE_CATEGORIES.TRANSPORT
    : SERVICE_CATEGORIES.VASY;
}

export function getServiceCategory(serviceDefinition) {
  if (!serviceDefinition) return SERVICE_CATEGORIES.VASY;
  if (SYSTEM_SERVICE_IDS.has(serviceDefinition.id)) return SERVICE_CATEGORIES.SYSTEM;
  return normalizeServiceCategory(serviceDefinition.category, serviceDefinition.name);
}

export function isTransportService(serviceDefinition) {
  return getServiceCategory(serviceDefinition) === SERVICE_CATEGORIES.TRANSPORT;
}
