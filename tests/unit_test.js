const test = require('node:test');
const assert = require('node:assert');
const { getTenantConfig } = require('../shared/tenantCache');
const { sessionService } = require('../sessions/sessionService');
const { runWithTenantConfig } = require('../shared/tenantContext');
const { whatsappClient } = require('../config/whatsapp');

test('Tenant Session Scoping', (t) => {
  // Test default session key
  const defaultKey = sessionService.getSessionKey('1234567890');
  assert.strictEqual(defaultKey, 'session:default:1234567890');

  // Test dynamic tenant session key
  runWithTenantConfig({ tenantId: 'hosp_apollo' }, () => {
    const tenantKey = sessionService.getSessionKey('1234567890');
    assert.strictEqual(tenantKey, 'session:hosp_apollo:1234567890');
  });
});

test('WhatsApp Client Dynamic Config Resolution', (t) => {
  // Test default base URL and headers fallback
  assert.strictEqual(whatsappClient.baseUrl, 'https://graph.facebook.com/v19.0/mock_phone_number_id');
  assert.strictEqual(whatsappClient.headers.Authorization, 'Bearer mock_access_token');

  // Test dynamic base URL and headers override
  runWithTenantConfig({ accessToken: 'hosp_token_123', phoneNumberId: 'hosp_phone_123' }, () => {
    assert.strictEqual(whatsappClient.baseUrl, 'https://graph.facebook.com/v19.0/hosp_phone_123');
    assert.strictEqual(whatsappClient.headers.Authorization, 'Bearer hosp_token_123');
  });
});

test('Tenant Cache Validation', async (t) => {
  // Test lookup null phoneId returns null
  const nullConfig = await getTenantConfig(null);
  assert.strictEqual(nullConfig, null);
});
