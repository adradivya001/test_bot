const { backendClient } = require('../controllers/backendClient');
const { responseFormatter } = require('../controllers/responseFormatter');
const { WORKFLOWS } = require('../shared/constants');
const { logger } = require('../logger/logger');

class ReportsWorkflow {
  async handle(message, session) {
    logger.info(`Running Reports Workflow`, { phone: message.phone });

    const backendRequest = {
      phone: message.phone
    };

    const backendResponse = await backendClient.getReportStatus(backendRequest);

    // Report check is a one-shot query. Reset workflow session.
    const updatedSession = {
      ...session,
      currentWorkflow: null,
      currentStep: null,
      collectedData: {}
    };

    const rawData = backendResponse.data || backendResponse;
    const formattedResponse = responseFormatter.formatReportResponse(rawData, session.language);

    return {
      session: updatedSession,
      response: formattedResponse
    };
  }
}

const reportsWorkflow = new ReportsWorkflow();
module.exports = { reportsWorkflow };
