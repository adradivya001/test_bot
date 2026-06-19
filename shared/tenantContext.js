const { AsyncLocalStorage } = require('async_hooks');

const tenantContext = new AsyncLocalStorage();

function runWithTenantConfig(config, fn) {
  return tenantContext.run(config, fn);
}

function getTenantConfig() {
  return tenantContext.getStore();
}

module.exports = { runWithTenantConfig, getTenantConfig };
