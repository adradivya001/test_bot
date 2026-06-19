import { webhookService } from '../src/webhook/webhook.service';
import { MetaWebhookPayload } from '../src/meta/meta.types';

describe('Webhook Service', () => {
  it('should normalize standard text incoming message payloads', () => {
    const payload: MetaWebhookPayload = {
      object: 'whatsapp_business_account',
      entry: [{
        id: '123',
        changes: [{
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '123',
              phone_number_id: '456'
            },
            contacts: [{
              profile: { name: 'Bob Johnson' },
              wa_id: '15551234567'
            }],
            messages: [{
              from: '15551234567',
              id: 'msg_001',
              timestamp: '1717849100',
              type: 'text',
              text: { body: 'Check results' }
            }]
          }
        }]
      }]
    };

    const messages = webhookService.normalizeIncomingPayload(payload);
    expect(messages).toHaveLength(1);
    expect(messages[0].phone).toBe('15551234567');
    expect(messages[0].name).toBe('Bob Johnson');
    expect(messages[0].type).toBe('text');
    expect(messages[0].text).toBe('Check results');
    expect(messages[0].payload).toBe('');
  });

  it('should normalize interactive button replies', () => {
    const payload: MetaWebhookPayload = {
      object: 'whatsapp_business_account',
      entry: [{
        id: '123',
        changes: [{
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '123',
              phone_number_id: '456'
            },
            contacts: [{
              profile: { name: 'Bob Johnson' },
              wa_id: '15551234567'
            }],
            messages: [{
              from: '15551234567',
              id: 'msg_002',
              timestamp: '1717849100',
              type: 'interactive',
              interactive: {
                type: 'button_reply',
                button_reply: {
                  id: 'btn_confirm',
                  title: 'Yes, Confirm'
                }
              }
            }]
          }
        }]
      }]
    };

    const messages = webhookService.normalizeIncomingPayload(payload);
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe('button_reply');
    expect(messages[0].text).toBe('Yes, Confirm');
    expect(messages[0].payload).toBe('btn_confirm');
  });

  it('should normalize interactive list replies', () => {
    const payload: MetaWebhookPayload = {
      object: 'whatsapp_business_account',
      entry: [{
        id: '123',
        changes: [{
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '123',
              phone_number_id: '456'
            },
            contacts: [{
              profile: { name: 'Bob Johnson' },
              wa_id: '15551234567'
            }],
            messages: [{
              from: '15551234567',
              id: 'msg_003',
              timestamp: '1717849100',
              type: 'interactive',
              interactive: {
                type: 'list_reply',
                list_reply: {
                  id: 'row_doctor_1',
                  title: 'Dr. Kumar',
                  description: 'Cardiologist'
                }
              }
            }]
          }
        }]
      }]
    };

    const messages = webhookService.normalizeIncomingPayload(payload);
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe('list_reply');
    expect(messages[0].text).toBe('Dr. Kumar');
    expect(messages[0].payload).toBe('row_doctor_1');
  });
});
