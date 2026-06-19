const { backendClient } = require('../controllers/backendClient');
const { responseFormatter } = require('../controllers/responseFormatter');
const { logger } = require('../logger/logger');
const { translationService } = require('../shared/translationService');

class KnowledgeWorkflow {
  async handle(message, session) {
    logger.info(`Running Knowledge Workflow`, { phone: message.phone });
    const language = session.language || 'en';

    const backendRequest = {
      phone: message.phone,
      step: session.currentStep,
      collectedData: session.collectedData,
      messageText: message.text,
      payloadText: message.payload
    };

    const backendResponse = await backendClient.queryKnowledgeBase(backendRequest, language);

    const rawData = backendResponse.data || backendResponse;

    // If knowledge base search failed, automatically escalate to human support
    if (rawData && rawData.source === 'FALLBACK') {
      logger.info('Knowledge base fallback triggered. Automatically escalating to live agent support.');
      const { escalationWorkflow } = require('./escalation.workflow');
      
      const escalationSession = {
        ...session,
        currentWorkflow: 'HUMAN_ESCALATION',
        currentStep: 'START'
      };
      
      const escalationResult = await escalationWorkflow.handle(message, escalationSession);
      
      const fallbackMsg = {
        type: 'text',
        text: rawData.answer || translationService.translate('kb_answer_fallback', language)
      };
      
      const responses = Array.isArray(escalationResult.response)
        ? [fallbackMsg, ...escalationResult.response]
        : [fallbackMsg, escalationResult.response];
        
      return {
        session: escalationResult.session,
        response: responses
      };
    }

    // Otherwise, knowledge base is one-shot query. Reset workflow session.
    const updatedSession = {
      ...session,
      currentWorkflow: null,
      currentStep: null,
      collectedData: {}
    };

    const formattedResponse = responseFormatter.formatKnowledgeResponse(rawData, language);

    return {
      session: updatedSession,
      response: formattedResponse
    };
  }
}

const knowledgeWorkflow = new KnowledgeWorkflow();
module.exports = { knowledgeWorkflow };
