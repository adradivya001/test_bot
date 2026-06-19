const { sessionService } = require('../sessions/sessionService');
const { workflowRouter } = require('./workflowRouter');
const { whatsappClient } = require('../config/whatsapp');
const { logger } = require('../logger/logger');
const { FALLBACK_MESSAGE } = require('../shared/constants');

// Memory cache for Meta message deduplication (stores messageIds for last 10 mins)
const processedMessageIds = new Set();
setInterval(() => processedMessageIds.clear(), 10 * 60 * 1000);

class MessageController {
  
  /**
   * Helper to clean zero-width spaces and other invisible characters
   */
  cleanText(text) {
    if (!text) return '';
    return text.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  }

  /**
   * Meta verify webhook (GET /webhook)
   */
  verifyWebhook(req, res) {
    const { env } = require('../config/env');
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
      if (mode === 'subscribe' && token === env.META_VERIFY_TOKEN) {
        logger.info('Webhook verified successfully by Meta');
        res.status(200).send(challenge);
      } else {
        logger.warn('Webhook verification failed: token mismatch', { receivedToken: token });
        res.sendStatus(403);
      }
    } else {
      logger.warn('Webhook verification failed: missing mode or token');
      res.sendStatus(400);
    }
  }

  /**
   * Meta webhook receiver (POST /webhook)
   */
  async handleWebhook(req, res) {
    const body = req.body;
    logger.debug('Received webhook POST from Meta', { body });

    // Acknowledge receipt immediately (within 3s limit)
    res.status(200).send('EVENT_RECEIVED');

    try {
      const messages = this.normalizeMetaPayload(body);
      if (messages.length === 0) return;

      for (const msg of messages) {
        // Deduplication
        if (processedMessageIds.has(msg.messageId)) {
          logger.info(`Ignoring duplicate message ID: ${msg.messageId}`);
          continue;
        }
        processedMessageIds.add(msg.messageId);

        // Process message
        const cleanMsgText = this.cleanText(msg.text);
        msg.text = cleanMsgText;

        logger.info(`Processing Meta Message`, { phone: msg.phone, text: msg.text });

        const session = await sessionService.getSession(msg.phone);
        const result = await workflowRouter.routeMessage(msg, session);
        await sessionService.updateSession(msg.phone, result.session);

        // Send responses back to patient via WhatsApp API client
        await this.sendOutgoingResponses(msg.phone, result.response);
      }
    } catch (error) {
      logger.error('Error handling Meta Webhook POST', { error });
    }
  }

  /**
   * Web Simulator Handler (POST /api/simulator/send)
   * Directly routes messages and returns responses in HTTP body
   */
  async handleSimulatorMessage(req, res) {
    const { phone, text, payload, name } = req.body;
    const cleanMsgText = this.cleanText(text);

    logger.info(`Received Simulator Message`, { phone, text: cleanMsgText, payload });

    const simulatedMessage = {
      phone: phone || '1234567890',
      name: name || 'Simulated Patient',
      messageId: 'sim_' + Date.now() + '_' + Math.random().toString(36).substring(7),
      type: payload ? 'button_reply' : 'text',
      text: cleanMsgText,
      payload: payload || '',
      raw: req.body
    };

    try {
      const session = await sessionService.getSession(simulatedMessage.phone);
      const result = await workflowRouter.routeMessage(simulatedMessage, session);
      await sessionService.updateSession(simulatedMessage.phone, result.session);

      // Return responses and updated session
      const responseList = Array.isArray(result.response) ? result.response : [result.response];
      res.status(200).json({
        success: true,
        responses: responseList.filter(Boolean),
        session: result.session
      });
    } catch (error) {
      logger.error('Error handling simulator message', { error });
      res.status(500).json({
        success: false,
        error: error.message,
        responses: [{ type: 'text', text: FALLBACK_MESSAGE }]
      });
    }
  }

  /**
   * Internal parser for Meta Webhook format
   */
  normalizeMetaPayload(payload) {
    const normalizedMessages = [];
    try {
      const entries = payload.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          const value = change.value;
          if (!value || !value.messages || value.messages.length === 0) continue;

          const contacts = value.contacts || [];
          const contactMap = new Map();
          contacts.forEach(contact => {
            if (contact.wa_id && contact.profile?.name) {
              contactMap.set(contact.wa_id, contact.profile.name);
            }
          });

          for (const msg of value.messages) {
            const phone = msg.from;
            const name = contactMap.get(phone) || 'Patient';
            const messageId = msg.id;

            let type = 'unsupported';
            let text = '';
            let payloadText = '';

            if (msg.type === 'text' && msg.text) {
              type = 'text';
              text = msg.text.body || '';
            } else if (msg.type === 'interactive' && msg.interactive) {
              const interactiveType = msg.interactive.type;
              
              if (interactiveType === 'button_reply' && msg.interactive.button_reply) {
                type = 'button_reply';
                text = msg.interactive.button_reply.title || '';
                payloadText = msg.interactive.button_reply.id || '';
              } else if (interactiveType === 'list_reply' && msg.interactive.list_reply) {
                type = 'list_reply';
                text = msg.interactive.list_reply.title || '';
                payloadText = msg.interactive.list_reply.id || '';
              }
            }

            normalizedMessages.push({
              phone,
              name,
              messageId,
              type,
              text,
              payload: payloadText,
              raw: msg
            });
          }
        }
      }
    } catch (error) {
      logger.error('Error normalizing Meta payload', { error, payload });
    }
    return normalizedMessages;
  }

  /**
   * Sends actual outbound Meta messages
   */
  async sendOutgoingResponses(to, responses) {
    const responseList = Array.isArray(responses) ? responses : [responses];

    for (const resp of responseList) {
      if (!resp) continue;

      logger.info(`Sending formatted outgoing response via Meta Client`, { to, type: resp.type, text: resp.text });

      switch (resp.type) {
        case 'text':
          await whatsappClient.sendText(to, resp.text);
          break;
        
        case 'buttons':
          if (resp.buttons && resp.buttons.length > 0) {
            await whatsappClient.sendButtons(to, resp.text, resp.buttons);
          } else {
            await whatsappClient.sendText(to, resp.text);
          }
          break;

        case 'list':
          if (resp.list) {
            await whatsappClient.sendList(to, resp.text, resp.list);
          } else {
            await whatsappClient.sendText(to, resp.text);
          }
          break;

        case 'template':
          if (resp.template) {
            await whatsappClient.sendTemplate(to, resp.template);
          } else {
            await whatsappClient.sendText(to, resp.text);
          }
          break;

        default:
          logger.warn(`Unsupported outgoing response type: ${resp.type}`);
      }
    }
  }
}

const messageController = new MessageController();
module.exports = { messageController };
