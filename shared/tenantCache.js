const axios = require('axios');
const { env } = require('../config/env');
const { logger } = require('../logger/logger');

// Local in-memory cache map
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 Minutes TTL

async function getTenantConfig(phoneNumberId) {
  if (!phoneNumberId) return null;

  const cached = cache.get(phoneNumberId);
  const now = Date.now();

  if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
    logger.debug(`Tenant cache hit for phone ID: ${phoneNumberId}`);
    return cached.data;
  }

  logger.info(`Tenant cache miss for phone ID: ${phoneNumberId}. Querying backend...`);
  try {
    const resp = await axios.get(`${env.BACKEND_API_URL}/internal/tenant-lookup?phone_id=${phoneNumberId}`);
    const tenantConfig = resp.data.data;
    
    if (tenantConfig) {
      cache.set(phoneNumberId, {
        data: tenantConfig,
        timestamp: now
      });
    }
    return tenantConfig;
  } catch (err) {
    logger.error(`Failed to lookup tenant for phone ID ${phoneNumberId} from backend: ${err.message}`);
    // If lookup fails but we have stale cached data, fall back to it
    if (cached) {
      logger.warn(`Using stale cached tenant config for phone ID: ${phoneNumberId}`);
      return cached.data;
    }
    return null;
  }
}

module.exports = { getTenantConfig };
