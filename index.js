const express = require('express');
const cors = require('cors');
const path = require('path');
const { env } = require('./config/env');
const { logger } = require('./logger/logger');
const { messageController } = require('./controllers/messageController');
const { whatsappClient } = require('./config/whatsapp');

const app = express();

// Global Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`HTTP Request: ${req.method} ${req.path}`);
  next();
});

// Serve static files from public folder (WhatsApp Simulator UI)
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Meta Webhook Verification
app.get('/webhook', (req, res) => {
  messageController.verifyWebhook(req, res);
});

// Meta Webhook Message Ingestion
app.post('/webhook', (req, res) => {
  messageController.handleWebhook(req, res);
});

// Web Simulator message routing endpoint
app.post('/api/simulator/send', (req, res) => {
  messageController.handleSimulatorMessage(req, res);
});

// Internal endpoint to send messages manually
app.post('/v1/send-message', async (req, res) => {
  const { to, text } = req.body;
  if (!to || !text) {
    return res.status(400).json({ success: false, error: 'Missing to or text in body' });
  }

  try {
    const result = await whatsappClient.sendText(to, text);
    res.status(200).json({ success: true, result });
  } catch (error) {
    logger.error('Failed to send outbound message via manual endpoint', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Serve index.html for any other GET requests (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  logger.error('Unhandled server error', { error: err });
  res.status(500).json({
    status: 'error',
    message: 'An internal server error occurred.'
  });
});

// Start listening
let server;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(env.PORT, () => {
    logger.info(`🚀 DFO WhatsApp Automation Engine running on port ${env.PORT}`);
    logger.info(`Web Simulator available at http://localhost:${env.PORT}`);
    logger.info(`Meta Webhook URL: http://<your-domain>:${env.PORT}/webhook`);
    logger.info(`Verify Token: ${env.META_VERIFY_TOKEN}`);
    logger.info(`Active Mode: ${env.NODE_ENV}`);
  });
}

// Graceful shutdown
const shutdown = () => {
  logger.info('Received shutdown signal, closing server...');
  if (server) {
    server.close(() => {
      logger.info('Server closed. Exiting.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = app;
