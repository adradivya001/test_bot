const { backendClient } = require('../controllers/backendClient');
const { responseFormatter } = require('../controllers/responseFormatter');
const { WORKFLOWS } = require('../shared/constants');
const { logger } = require('../logger/logger');

class AppointmentWorkflow {
  async handle(message, session) {
    logger.info(`Running Appointment Workflow`, { phone: message.phone, currentStep: session.currentStep });

    const step = session.currentStep || 'START';
    const backendRequest = {
      phone: message.phone,
      step,
      collectedData: session.collectedData,
      messageText: message.text,
      payloadText: message.payload
    };

    const backendResponse = await backendClient.bookAppointment(backendRequest, session.language);

    const nextStep = backendResponse.nextStep;
    const updatedSession = {
      ...session,
      currentWorkflow: nextStep ? WORKFLOWS.APPOINTMENT_BOOKING : null,
      currentStep: nextStep,
      collectedData: backendResponse.collectedData
    };

    // Handle slot conflict — keep user on SELECT_SLOT with cleared slot data
    if (backendResponse.data && backendResponse.data.status === 'slot_conflict') {
      updatedSession.currentWorkflow = WORKFLOWS.APPOINTMENT_BOOKING;
      updatedSession.currentStep = 'SELECT_SLOT';
      // Clear the conflicted slot so user can re-select
      if (updatedSession.collectedData) {
        delete updatedSession.collectedData.slot;
      }
    }

    // Store doctor ID to doctor name mappings in the session
    if (backendResponse.data && backendResponse.data.status === 'select_doctor') {
      const doctorNames = updatedSession.collectedData.doctorNames || {};
      const doctors = backendResponse.data.doctors || [];
      doctors.forEach(doc => {
        if (doc.includes('(')) {
          const name = doc.split(' (')[0];
          const id = doc.substring(doc.indexOf('(') + 1, doc.indexOf(')'));
          doctorNames[id] = name;
        }
      });
      updatedSession.collectedData.doctorNames = doctorNames;
    }

    const formattedResponse = responseFormatter.formatAppointmentResponse(
      backendResponse.data,
      updatedSession.collectedData,
      session.language
    );

    return {
      session: updatedSession,
      response: formattedResponse
    };
  }
}

const appointmentWorkflow = new AppointmentWorkflow();
module.exports = { appointmentWorkflow };
