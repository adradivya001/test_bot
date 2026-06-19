const axios = require('axios');
const { env } = require('../config/env');
const { logger } = require('../logger/logger');

class BackendClient {
  get baseUrl() {
    return env.BACKEND_API_URL;
  }

  async postToBackend(endpoint, requestBody) {
    const url = `${this.baseUrl}${endpoint}`;
    logger.info(`Sending request to Core Backend: ${endpoint}`, { requestBody });

    try {
      const response = await axios.post(url, requestBody, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000 // Increased timeout for remote Supabase queries
      });
      logger.info(`Core Backend response success: ${endpoint}`, { responseData: response.data });
      return response.data;
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      logger.warn(`Failed to connect to backend at ${url}. Falling back to mock data...`, { error: errorMsg });
      return this.getMockResponse(endpoint, requestBody);
    }
  }

  async getDepartments() {
    const url = `${this.baseUrl}/departments`;
    logger.info(`Fetching departments from core backend: ${url}`);
    try {
      const response = await axios.get(url, { timeout: 10000 });
      if (response.data && response.data.success && Array.isArray(response.data.data)) {
        return response.data.data;
      }
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      logger.warn(`Failed to fetch departments from ${url}. Returning mock...`, { error: error.message });
      return [{ id: '86bfd8bd-d992-44ce-ac91-27e81653382e', name: 'Cardiology', description: 'Heart care services' }];
    }
  }

  async getDoctorsByDepartment(deptId) {
    const url = `${this.baseUrl}/doctors/department/${deptId}`;
    logger.info(`Fetching doctors by department from core backend: ${url}`);
    try {
      const response = await axios.get(url, { timeout: 10000 });
      if (response.data && response.data.success && Array.isArray(response.data.data)) {
        return response.data.data;
      }
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      logger.warn(`Failed to fetch doctors from ${url}. Returning mock...`, { error: error.message });
      return [{ doctorId: 'c80f64dc-2f3d-4d7f-94d5-88496188240b', name: 'Dr. Kumar', specialization: 'Cardiologist' }];
    }
  }

  async bookAppointment(request, language) {
    return this.postToBackend('/api/workflows/appointment', {
      ...request,
      language: (language || 'en').toUpperCase()
    });
  }

  async checkDoctorAvailability(request) {
    // request expects: { doctorId, date }
    return this.postToBackend('/api/workflows/doctor-availability', {
      doctorId: request.doctorId,
      date: request.date
    });
  }

  async getReportStatus(request) {
    // request expects: { phone }
    return this.postToBackend('/api/workflows/report-status', {
      phone: request.phone
    });
  }

  async queryKnowledgeBase(request, language) {
    // request expects: { phone, messageText }
    return this.postToBackend('/api/workflows/knowledge', {
      query: request.messageText,
      language: (language || 'en').toUpperCase()
    });
  }

  async escalateToHuman(request) {
    // request expects: { phone, messageText, conversationId }
    return this.postToBackend('/api/workflows/escalation', {
      phone: request.phone,
      conversationId: request.conversationId || `conv_${Date.now()}`,
      issue: request.messageText || 'Escalated from WhatsApp automation bot'
    });
  }

  async getPatientPreferences(phone) {
    const url = `${this.baseUrl}/api/workflows/preferences/${phone}`;
    logger.info(`Fetching patient preferences from core backend: ${url}`);
    try {
      const response = await axios.get(url, { timeout: 10000 });
      return response.data;
    } catch (error) {
      logger.warn(`Failed to fetch preferences from ${url}. Returning default...`, { error: error.message });
      return { preferredLanguage: 'en' };
    }
  }

  async updatePatientPreferences(phone, preferredLanguage) {
    const url = `${this.baseUrl}/api/workflows/preferences/${phone}`;
    logger.info(`Updating patient preferences on core backend: ${url}`, { preferredLanguage });
    try {
      const response = await axios.patch(url, { preferredLanguage }, { timeout: 10000 });
      return response.data;
    } catch (error) {
      logger.warn(`Failed to update preferences at ${url}. Returning fallback...`, { error: error.message });
      return { success: false };
    }
  }

  getMockResponse(endpoint, request) {
    const collectedData = { ...request.collectedData };
    let status = 'success';
    let nextStep = null;
    let data = {};

    const text = (request.messageText || '').toLowerCase().trim();
    const payload = request.payloadText;

    if (endpoint.includes('appointment')) {
      const step = request.step || 'START';
      if (step === 'START') {
        nextStep = 'SELECT_DOCTOR';
        status = 'pending';
        data = {
          status: 'select_doctor',
          doctors: ['Cardiology (dept-cardio)', 'Pediatrics (dept-pedia)', 'General Medicine (dept-gen)']
        };
      } else if (step === 'SELECT_DOCTOR') {
        const userInput = payload || request.messageText || '';
        if (userInput.startsWith('dept-')) {
          collectedData.departmentId = userInput;
          nextStep = 'SELECT_DOCTOR';
          status = 'pending';
          if (userInput === 'dept-cardio') {
            data = {
              status: 'select_doctor',
              doctors: ['Dr. Kumar (doc-kumar)']
            };
          } else if (userInput === 'dept-pedia') {
            data = {
              status: 'select_doctor',
              doctors: ['Dr. Sharma (doc-sharma)']
            };
          } else {
            data = {
              status: 'select_doctor',
              doctors: ['Dr. Patil (doc-patil)']
            };
          }
        } else {
          collectedData.doctor = userInput;
          collectedData.doctorId = userInput;
          nextStep = 'SELECT_DATE';
          status = 'pending';
          data = {
            status: 'select_date',
            doctor: userInput,
            dates: ['2026-06-17', '2026-06-18', '2026-06-19']
          };
        }
      } else if (step === 'SELECT_DATE') {
        collectedData.date = payload || request.messageText;
        nextStep = 'SELECT_SLOT';
        status = 'pending';
        data = {
          status: 'select_slot',
          doctor: collectedData.doctor,
          date: collectedData.date,
          slots: ['09:00 AM', '11:00 AM', '02:00 PM', '04:00 PM']
        };
      } else if (step === 'SELECT_SLOT') {
        collectedData.slot = payload || request.messageText;
        nextStep = null;
        status = 'success';
        data = {
          status: 'confirmed',
          appointmentId: 'APT-' + Math.floor(100000 + Math.random() * 900000),
          doctor: collectedData.doctor,
          date: collectedData.date,
          time: collectedData.slot
        };
      }
    } else if (endpoint.includes('doctor-availability')) {
      const doctorName = request.doctorId === 'c80f64dc-2f3d-4d7f-94d5-88496188240b' ? 'Dr. Kumar' : (request.doctorId || 'Dr. Kumar');
      status = 'success';
      nextStep = null;
      data = {
        available: true,
        doctor: doctorName,
        slots: ['10:00 AM', '11:00 AM', '03:00 PM']
      };
    } else if (endpoint.includes('report-status')) {
      status = 'success';
      nextStep = null;
      data = {
        status: 'READY',
        reportId: 'REP10023',
        reportType: 'Complete Blood Count (CBC)',
        createdAt: new Date().toISOString(),
        eta: 'Ready for download',
        downloadUrl: 'https://dfo-hospital.com/reports/download/rep123'
      };
    } else if (endpoint.includes('knowledge')) {
      nextStep = null;
      status = 'success';
      data = {
        answer: `Thank you for asking about DFO Hospital. DFO Hospital is located at 123 Health Avenue. Our visiting hours are 9:00 AM to 8:00 PM daily. We offer Cardiology, Pediatrics, Neurology, and General Medicine services.`,
        confidence: 0.95,
        suggestions: ['Book Appointment', 'Check Doctor Availability']
      };
    } else if (endpoint.includes('escalation')) {
      nextStep = null;
      status = 'escalated';
      data = {
        agentAssigned: true,
        queuePosition: 1,
        message: 'Connecting you to a live support representative. They will chat with you here shortly.'
      };
    }

    return {
      nextStep,
      collectedData,
      status,
      data
    };
  }
}

const backendClient = new BackendClient();
module.exports = { backendClient };
