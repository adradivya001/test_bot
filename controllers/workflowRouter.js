const { intentDetector } = require('./intentDetector');
const { WORKFLOWS, INTENTS } = require('../shared/constants');
const { logger } = require('../logger/logger');
const { backendClient } = require('./backendClient');
const { translationService } = require('../shared/translationService');

// Workflows import
const { appointmentWorkflow } = require('../workflows/appointment.workflow');
const { availabilityWorkflow } = require('../workflows/availability.workflow');
const { reportsWorkflow } = require('../workflows/reports.workflow');
const { knowledgeWorkflow } = require('../workflows/knowledge.workflow');
const { escalationWorkflow } = require('../workflows/escalation.workflow');

function detectLanguageByScript(text) {
  const clean = text || '';
  if (/[\u0C00-\u0C7F]/.test(clean)) return 'te'; // Telugu script block
  if (/[\u0900-\u097F]/.test(clean)) return 'hi'; // Devanagari script block
  return null;
}

class WorkflowRouter {
  async routeMessage(message, session) {
    const text = (message.text || '').toLowerCase().trim();

    // A. Check for manual language change commands
    const isLangChange = text === 'change language' || text === 'भाषा बदलें' || text === 'భాష మార్చండి';
    if (isLangChange) {
      logger.info(`Language change command received from ${message.phone}`);
      const freshSession = {
        phone: message.phone,
        currentWorkflow: 'LANGUAGE_SELECTION',
        currentStep: 'PROMPT',
        language: null,
        collectedData: {},
        lastMessageAt: Date.now()
      };
      return {
        session: freshSession,
        response: this.getLanguageMenu()
      };
    }

    // B. If user is in the language selection workflow
    if (session.currentWorkflow === 'LANGUAGE_SELECTION') {
      const selected = this.parseLanguageSelection(message.payload || message.text);
      if (selected) {
        logger.info(`User ${message.phone} selected language: ${selected}`);
        const updatedSession = {
          ...session,
          currentWorkflow: null,
          currentStep: null,
          language: selected,
          collectedData: {}
        };
        // Persist on backend asynchronously
        backendClient.updatePatientPreferences(message.phone, selected).catch(err => {
          logger.warn(`Failed to sync preferred language to backend: ${err.message}`);
        });

        const welcomeText = translationService.translate('language_changed_success', selected);
        const welcomeMenu = this.getHelpMenu(selected);
        return {
          session: updatedSession,
          response: {
            type: 'buttons',
            text: `${welcomeText}\n\n${welcomeMenu.text}`,
            buttons: welcomeMenu.buttons
          }
        };
      } else {
        return {
          session,
          response: this.getLanguageMenu()
        };
      }
    }

    // C. Initialize language if missing
    if (!session.language) {
      const prefs = await backendClient.getPatientPreferences(message.phone);
      if (prefs && prefs.preferredLanguage && ['en', 'hi', 'te'].includes(prefs.preferredLanguage)) {
        session.language = prefs.preferredLanguage;
        logger.info(`Restored language preference from backend: ${session.language} for ${message.phone}`);
      } else {
        const detected = detectLanguageByScript(message.text);
        if (detected) {
          session.language = detected;
          logger.info(`Auto-detected language by Unicode script: ${session.language} for ${message.phone}`);
          backendClient.updatePatientPreferences(message.phone, detected).catch(err => {
            logger.warn(`Failed to sync auto-detected language to backend: ${err.message}`);
          });
        } else {
          logger.info(`Language preference unknown for ${message.phone}. Presenting language selection menu.`);
          const freshSession = {
            ...session,
            currentWorkflow: 'LANGUAGE_SELECTION',
            currentStep: 'PROMPT'
          };
          return {
            session: freshSession,
            response: this.getLanguageMenu()
          };
        }
      }
    }

    // Global Command: Allow exiting any workflow by typing "exit", "cancel", "menu" or basic greetings
    if (text === 'exit' || text === 'cancel' || text === 'menu' || text === 'hello' || text === 'hi' || text === 'hey') {
      logger.info(`Session reset command/greeting received from ${message.phone}`);
      const resetSession = {
        phone: message.phone,
        currentWorkflow: null,
        currentStep: null,
        language: session.language, // Preserve active language
        collectedData: {},
        lastMessageAt: Date.now()
      };
      
      const welcomeMenu = this.getHelpMenu(session.language);
      return {
        session: resetSession,
        response: welcomeMenu
      };
    }

    // 1. Check if there is an active session workflow
    if (session.currentWorkflow) {
      logger.info(`Routing message to active workflow: ${session.currentWorkflow}`, { phone: message.phone });

      switch (session.currentWorkflow) {
        case WORKFLOWS.APPOINTMENT_BOOKING:
          return appointmentWorkflow.handle(message, session);
        
        case WORKFLOWS.DOCTOR_AVAILABILITY:
          return availabilityWorkflow.handle(message, session);

        case WORKFLOWS.REPORT_STATUS:
          return reportsWorkflow.handle(message, session);

        case WORKFLOWS.KNOWLEDGE_QUERY:
          return knowledgeWorkflow.handle(message, session);

        case WORKFLOWS.HUMAN_ESCALATION:
          logger.info(`User ${message.phone} is currently in an escalated session. Ignoring automated messages.`);
          return {
            session,
            response: []
          };

        default:
          logger.error(`Unknown current workflow in session: ${session.currentWorkflow}`);
      }
    }

    // 2. No active workflow, run Intent Detection
    const intentResult = await intentDetector.detectIntent(message.text);
    logger.info(`Detected intent: ${intentResult.intent} (Confidence: ${intentResult.confidence})`, { phone: message.phone });

    switch (intentResult.intent) {
      case INTENTS.APPOINTMENT_BOOKING:
        return appointmentWorkflow.handle(message, { ...session, currentWorkflow: WORKFLOWS.APPOINTMENT_BOOKING, currentStep: 'START' });

      case INTENTS.DOCTOR_AVAILABILITY:
        return availabilityWorkflow.handle(message, { ...session, currentWorkflow: WORKFLOWS.DOCTOR_AVAILABILITY, currentStep: 'START' });

      case INTENTS.REPORT_STATUS:
        return reportsWorkflow.handle(message, { ...session, currentWorkflow: WORKFLOWS.REPORT_STATUS, currentStep: 'START' });

      case INTENTS.KNOWLEDGE_QUERY:
        return knowledgeWorkflow.handle(message, { ...session, currentWorkflow: WORKFLOWS.KNOWLEDGE_QUERY, currentStep: 'START' });

      case INTENTS.HUMAN_ESCALATION:
        return escalationWorkflow.handle(message, { ...session, currentWorkflow: WORKFLOWS.HUMAN_ESCALATION, currentStep: 'START' });

      case INTENTS.UNKNOWN:
      default:
        logger.info(`Unknown intent for message "${message.text}". Sending help menu.`, { phone: message.phone });
        return {
          session,
          response: this.getHelpMenu(session.language)
        };
    }
  }

  getLanguageMenu() {
    return {
      type: 'buttons',
      text: "Please select your language / कृपया अपनी भाषा चुनें / దయచేసి మీ భాషను ఎంచుకోండి:",
      buttons: [
        { id: 'LANG_EN', title: 'English 🇬🇧' },
        { id: 'LANG_HI', title: 'हिन्दी 🇮🇳' },
        { id: 'LANG_TE', title: 'తెలుగు 🇮🇳' }
      ]
    };
  }

  parseLanguageSelection(input) {
    const clean = (input || '').trim().toUpperCase();
    if (clean === 'LANG_EN' || clean === 'ENGLISH' || clean === '1') return 'en';
    if (clean === 'LANG_HI' || clean === 'हिन्दी' || clean === 'HINDI' || clean === '2') return 'hi';
    if (clean === 'LANG_TE' || clean === 'తెలుగు' || clean === 'TELUGU' || clean === '3') return 'te';
    return null;
  }

  getHelpMenu(language = 'en') {
    const welcome = translationService.translate('help_menu_welcome', language);
    const bookTitle = translationService.translate('help_menu_btn_book', language);
    const reportTitle = translationService.translate('help_menu_btn_report', language);
    const supportTitle = translationService.translate('help_menu_btn_support', language);

    return {
      type: 'buttons',
      text: welcome,
      buttons: [
        { id: 'BOOK_APPOINTMENT', title: bookTitle },
        { id: 'REPORT_STATUS', title: reportTitle },
        { id: 'HUMAN_ESCALATION', title: supportTitle }
      ]
    };
  }
}

const workflowRouter = new WorkflowRouter();
module.exports = { workflowRouter };
