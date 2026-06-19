const axios = require('axios');
const { env } = require('./env');
const { logger } = require('../logger/logger');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

class WhatsAppClient {
  get baseUrl() {
    return `https://graph.facebook.com/v19.0/${env.META_PHONE_NUMBER_ID}`;
  }

  get headers() {
    return {
      'Authorization': `Bearer ${env.META_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    };
  }

  async sendPostRequest(endpoint, payload) {
    const url = `${this.baseUrl}${endpoint}`;
    
    // Check for mock environment values to avoid crashing/rate limits in offline testing
    if (env.META_ACCESS_TOKEN === 'mock_access_token' || env.META_PHONE_NUMBER_ID === 'mock_phone_number_id') {
      logger.debug(`Mock WhatsApp Client: Skipping real Graph API call. Payload:`, payload);
      return { data: { messages: [{ id: 'mock_msg_' + Math.random().toString(36).substring(7) }] } };
    }

    try {
      const response = await axios.post(url, payload, { headers: this.headers });
      logger.info(`Meta API response success`, { data: response.data });
      return response.data;
    } catch (error) {
      const errorData = error.response?.data || error.message;
      logger.error(`Meta API request failed`, { error: errorData });
      throw new Error(`Meta API error: ${JSON.stringify(errorData)}`);
    }
  }

  /**
   * Sends text messages.
   * Auto-splits messages exceeding Meta's 4096 character limit.
   * Enables preview_url automatically if a YouTube link is present.
   */
  async sendText(to, text) {
    if (!text) return;

    // Detect YouTube link and normalize preview status
    const hasYouTubeLink = /youtube\.com|youtu\.be/i.test(text);

    // Meta's text body length limit is 4096 characters
    const CHAR_LIMIT = 4000;
    if (text.length > CHAR_LIMIT) {
      logger.info(`Text exceeds limit (${text.length} chars). Auto-splitting message...`);
      const chunks = [];
      let remainingText = text;

      while (remainingText.length > 0) {
        if (remainingText.length <= CHAR_LIMIT) {
          chunks.push(remainingText);
          break;
        }

        // Try to split at nearest newline or space
        let splitIndex = remainingText.lastIndexOf('\n', CHAR_LIMIT);
        if (splitIndex === -1) {
          splitIndex = remainingText.lastIndexOf(' ', CHAR_LIMIT);
        }
        if (splitIndex === -1) {
          splitIndex = CHAR_LIMIT;
        }

        chunks.push(remainingText.substring(0, splitIndex).trim());
        remainingText = remainingText.substring(splitIndex).trim();
      }

      const results = [];
      for (const chunk of chunks) {
        const payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: {
            body: chunk,
            preview_url: hasYouTubeLink
          }
        };
        const res = await this.sendPostRequest('/messages', payload);
        results.push(res);
      }
      return results;
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: {
        body: text,
        preview_url: hasYouTubeLink
      }
    };
    return this.sendPostRequest('/messages', payload);
  }

  async sendButtons(to, text, buttons) {
    // Meta supports max 3 buttons for interactive button replies
    const formattedButtons = buttons.slice(0, 3).map((btn) => ({
      type: 'reply',
      reply: {
        id: btn.id,
        title: btn.title.slice(0, 20) // Meta limit: 20 characters
      }
    }));

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text },
        action: { buttons: formattedButtons }
      }
    };
    return this.sendPostRequest('/messages', payload);
  }

  async sendList(to, text, list) {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text },
        action: {
          button: list.buttonText.slice(0, 20), // Meta limit: 20 characters
          sections: list.sections.map((sec) => ({
            title: sec.title?.slice(0, 24), // Meta limit: 24 characters
            rows: sec.rows.slice(0, 10).map((row) => ({ // Meta limit: 10 rows per section
              id: row.id,
              title: row.title.slice(0, 24), // Meta limit: 24 characters
              description: row.description?.slice(0, 72) // Meta limit: 72 characters
            }))
          }))
        }
      }
    };
    return this.sendPostRequest('/messages', payload);
  }

  async sendTemplate(to, template) {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: template.name,
        language: { code: template.languageCode },
        components: template.components
      }
    };
    return this.sendPostRequest('/messages', payload);
  }

  async markAsRead(messageId) {
    const payload = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId
    };
    return this.sendPostRequest('/messages', payload);
  }

  /**
   * Compresses image using sharp and prepares it for upload (or logs details)
   */
  async compressAndPrepareImage(filePath) {
    try {
      const ext = path.extname(filePath);
      const outputDir = path.dirname(filePath);
      const compressedPath = path.join(outputDir, `${path.basename(filePath, ext)}_compressed.jpg`);

      logger.info(`Compressing image ${filePath} with Sharp...`);
      await sharp(filePath)
        .resize({ width: 1024, withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(compressedPath);
      
      logger.info(`Image compressed successfully: ${compressedPath}`);
      return compressedPath;
    } catch (error) {
      logger.error('Sharp image compression failed', { error: error.message });
      return filePath; // Fallback to original file path if compression fails
    }
  }
}

const whatsappClient = new WhatsAppClient();
module.exports = { whatsappClient };
