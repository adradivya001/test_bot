const { backendClient } = require('../controllers/backendClient');
const { responseFormatter } = require('../controllers/responseFormatter');
const { WORKFLOWS } = require('../shared/constants');
const { logger } = require('../logger/logger');

class EscalationWorkflow {
  async handle(message, session) {
    logger.info(`Running Escalation Workflow`, { phone: message.phone });

    const backendRequest = {
      phone: message.phone,
      step: session.currentStep,
      collectedData: session.collectedData,
      messageText: message.text,
      payloadText: message.payload
    };

    const backendResponse = await backendClient.escalateToHuman(backendRequest);

    // Escalation keeps the workflow active as HUMAN_ESCALATION, locking them in until cleared by core
    const updatedSession = {
      ...session,
      currentWorkflow: WORKFLOWS.HUMAN_ESCALATION,
      currentStep: 'ESCALATED',
      collectedData: backendResponse.collectedData || {}
    };

    const rawData = backendResponse.data || backendResponse;
    const formattedResponse = responseFormatter.formatEscalationResponse(rawData, session.language);

    return {
      session: updatedSession,
      response: formattedResponse
    };
  }
}

const escalationWorkflow = new EscalationWorkflow();
module.exports = { escalationWorkflow };
