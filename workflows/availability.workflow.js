const { backendClient } = require('../controllers/backendClient');
const { responseFormatter } = require('../controllers/responseFormatter');
const { logger } = require('../logger/logger');
const { translationService } = require('../shared/translationService');

class AvailabilityWorkflow {
  async handle(message, session) {
    logger.info(`Running Availability Workflow`, { phone: message.phone, currentStep: session.currentStep });
    const language = session.language || 'en';
    const step = session.currentStep || 'START';

    if (step === 'START') {
      // Fetch departments from backend
      const departments = await backendClient.getDepartments();
      
      const updatedSession = {
        ...session,
        currentWorkflow: 'DOCTOR_AVAILABILITY',
        currentStep: 'SELECT_DEPT',
        collectedData: {}
      };

      const text = translationService.translate('avail_select_department_title', language);
      
      if (departments.length <= 3) {
        const buttons = departments.map(d => ({ id: d.id, title: d.name }));
        return { session: updatedSession, response: { type: 'buttons', text, buttons } };
      } else {
        const rows = departments.map(d => ({ id: d.id, title: d.name, description: d.description }));
        return {
          session: updatedSession,
          response: {
            type: 'list',
            text,
            list: {
              buttonText: translationService.translate('select_department_btn', language),
              sections: [{ title: translationService.translate('select_department_sec', language), rows }]
            }
          }
        };
      }
    }

    if (step === 'SELECT_DEPT') {
      const deptId = message.payload || message.text;
      const doctors = await backendClient.getDoctorsByDepartment(deptId);

      const updatedSession = {
        ...session,
        currentStep: 'SELECT_DOCTOR',
        collectedData: {
          ...session.collectedData,
          departmentId: deptId
        }
      };

      const text = translationService.translate('avail_select_doctor_title', language);
      
      if (doctors.length <= 3) {
        const buttons = doctors.map(d => ({ id: d.doctorId || d.id, title: d.name }));
        return { session: updatedSession, response: { type: 'buttons', text, buttons } };
      } else {
        const rows = doctors.map(d => ({ id: d.doctorId || d.id, title: d.name, description: d.specialization }));
        return {
          session: updatedSession,
          response: {
            type: 'list',
            text,
            list: {
              buttonText: translationService.translate('select_doctor_btn', language),
              sections: [{ title: translationService.translate('select_doctor_sec', language), rows }]
            }
          }
        };
      }
    }

    if (step === 'SELECT_DOCTOR') {
      const doctorId = message.payload || message.text;
      
      // Generate next 7 dates
      const dates = [];
      const today = new Date();
      for (let i = 1; i <= 7; i++) {
        const nextDate = new Date();
        nextDate.setDate(today.getDate() + i);
        const yyyy = nextDate.getFullYear();
        const mm = String(nextDate.getMonth() + 1).padStart(2, '0');
        const dd = String(nextDate.getDate()).padStart(2, '0');
        dates.push(`${yyyy}-${mm}-${dd}`);
      }

      const updatedSession = {
        ...session,
        currentStep: 'SELECT_DATE',
        collectedData: {
          ...session.collectedData,
          doctorId: doctorId,
          doctorName: message.text || 'Doctor'
        }
      };

      const text = translationService.translate('avail_select_date_title', language);
      const buttons = dates.slice(0, 3).map(d => ({ id: d, title: d }));
      
      return {
        session: updatedSession,
        response: { type: 'buttons', text, buttons }
      };
    }

    if (step === 'SELECT_DATE') {
      const dateStr = message.payload || message.text;
      
      const backendRequest = {
        doctorId: session.collectedData.doctorId,
        date: dateStr
      };

      const backendResponse = await backendClient.checkDoctorAvailability(backendRequest);

      // Clean up session since availability is a one-shot query, but preserve collected data
      // in case they decide to book immediately afterwards.
      const updatedSession = {
        ...session,
        currentWorkflow: null,
        currentStep: null,
        collectedData: {
          departmentId: session.collectedData.departmentId,
          doctorId: session.collectedData.doctorId,
          doctorName: session.collectedData.doctorName,
          doctor: session.collectedData.doctorId,
          date: dateStr
        }
      };

      const rawData = backendResponse.data || backendResponse;

      // Pass simulated doctor name if mock response has no clean name
      if (rawData && !rawData.doctor && session.collectedData.doctorName) {
        rawData.doctor = session.collectedData.doctorName;
      }

      const formattedResponse = responseFormatter.formatAvailabilityResponse(rawData, language);

      return {
        session: updatedSession,
        response: formattedResponse
      };
    }

    // Default fallback
    return {
      session: {
        ...session,
        currentWorkflow: null,
        currentStep: null,
        collectedData: {}
      },
      response: { type: 'text', text: translationService.translate('session_error', language) }
    };
  }
}

const availabilityWorkflow = new AvailabilityWorkflow();
module.exports = { availabilityWorkflow };
