const { translationService } = require('../shared/translationService');

class ResponseFormatter {
  formatAppointmentResponse(data, collectedData = {}, language = 'en') {
    const status = data.status || '';

    switch (status) {
      case 'registration_required': {
        const isInvalid = data.message && (data.message.includes('❌') || data.message.includes('Invalid'));
        const text = isInvalid 
          ? translationService.translate('patient_registration_invalid', language)
          : translationService.translate('patient_registration_required', language);
        return { type: 'text', text };
      }

      case 'select_doctor': {
        const doctors = data.doctors || [];
        const isDept = doctors.length > 0 && !doctors.some(doc => doc.toLowerCase().includes('dr.'));
        
        const text = isDept 
          ? translationService.translate('select_department_title', language)
          : translationService.translate('select_doctor_title', language);
        const buttonText = isDept 
          ? translationService.translate('select_department_btn', language)
          : translationService.translate('select_doctor_btn', language);
        const sectionTitle = isDept 
          ? translationService.translate('select_department_sec', language)
          : translationService.translate('select_doctor_sec', language);
        
        if (doctors.length <= 3) {
          const buttons = doctors.map((doc) => ({
            id: doc.includes('(') ? doc.substring(doc.indexOf('(') + 1, doc.indexOf(')')) : doc,
            title: doc.split(' (')[0]
          }));
          return { type: 'buttons', text, buttons };
        } else {
          const rows = doctors.map((doc) => ({
            id: doc.includes('(') ? doc.substring(doc.indexOf('(') + 1, doc.indexOf(')')) : doc,
            title: doc.split(' (')[0],
            description: doc.includes('(') ? doc.substring(doc.indexOf('(') + 1, doc.indexOf(')')) : undefined
          }));
          return {
            type: 'list',
            text,
            list: {
              buttonText,
              sections: [{ title: sectionTitle, rows }]
            }
          };
        }
      }

      case 'select_date': {
        const rawDoctor = data.doctor;
        const doctorName = (collectedData.doctorNames && collectedData.doctorNames[rawDoctor]) || rawDoctor;
        
        const text = translationService.translate('select_date_title', language, { doctorName });
        const dates = data.dates || [];

        if (dates.length <= 3) {
          const buttons = dates.map((d) => ({ id: d, title: d }));
          return { type: 'buttons', text, buttons };
        } else {
          const rows = dates.map((d) => ({ id: d, title: d }));
          return {
            type: 'list',
            text,
            list: {
              buttonText: translationService.translate('select_date_btn', language),
              sections: [{ title: translationService.translate('select_date_sec', language), rows }]
            }
          };
        }
      }

      case 'select_slot': {
        const text = translationService.translate('select_slot_title', language, { date: data.date });
        const slots = data.slots || [];

        if (slots.length <= 3) {
          const buttons = slots.map((s) => ({ id: s, title: s }));
          return { type: 'buttons', text, buttons };
        } else {
          const rows = slots.map((s) => ({ id: s, title: s }));
          return {
            type: 'list',
            text,
            list: {
              buttonText: translationService.translate('select_slot_btn', language),
              sections: [{ title: translationService.translate('select_slot_sec', language), rows }]
            }
          };
        }
      }

      case 'slot_conflict': {
        const slots = data.slots || [];
        const conflictMsg = data.message || 'The selected slot is no longer available.';
        
        if (slots.length === 0) {
          // No more slots available for this date
          const text = translationService.translate('slot_conflict_no_slots', language, {
            message: conflictMsg
          });
          return { type: 'text', text };
        }

        const text = translationService.translate('slot_conflict', language, {
          message: conflictMsg,
          date: data.date || ''
        });
        
        if (slots.length <= 3) {
          const buttons = slots.map((s) => ({ id: s, title: s }));
          return { type: 'buttons', text, buttons };
        } else {
          const rows = slots.map((s) => ({ id: s, title: s }));
          return {
            type: 'list',
            text,
            list: {
              buttonText: translationService.translate('select_slot_btn', language),
              sections: [{ title: translationService.translate('select_slot_sec', language), rows }]
            }
          };
        }
      }

      case 'confirmed': {
        const rawDoctor = data.doctor;
        const doctorName = (collectedData.doctorNames && collectedData.doctorNames[rawDoctor]) || rawDoctor;
        
        const text = translationService.translate('booking_confirmed', language, {
          appointmentId: data.appointmentId,
          doctorName,
          date: data.date,
          time: data.time
        });
        return { type: 'text', text };
      }

      default:
        return { type: 'text', text: data.message || "Thank you." };
    }
  }

  formatAvailabilityResponse(data, language = 'en') {
    if (data.available === false || data.status === 'unavailable' || !data.slots || data.slots.length === 0) {
      return {
        type: 'text',
        text: translationService.translate('doctor_unavailable', language, { doctorName: data.doctor || 'Doctor' })
      };
    }

    let slotsText = '';
    data.slots.forEach((slot) => {
      slotsText += `• ${slot}\n`;
    });

    const text = translationService.translate('doctor_available', language, {
      doctorName: data.doctor || 'Doctor',
      slots: slotsText.trim()
    });

    if (data.slots.length <= 3) {
      const buttons = data.slots.map((s) => ({
        id: `avail_slot_${s}`,
        title: s
      }));
      return { type: 'buttons', text, buttons };
    }

    return { type: 'text', text };
  }

  formatReportResponse(data, language = 'en') {
    const { env } = require('../config/env');
    const status = (data.status || '').toLowerCase();
    
    switch (status) {
      case 'ready': {
        const downloadUrl = data.downloadUrl 
          ? (data.downloadUrl.startsWith('http') ? data.downloadUrl : `${env.BACKEND_API_URL}${data.downloadUrl}`)
          : '';
        const dateStr = data.createdAt ? new Date(data.createdAt).toLocaleDateString() : '';
        const text = translationService.translate('report_ready', language, {
          reportId: data.reportId || '',
          reportType: data.reportType || '',
          createdAt: dateStr,
          downloadUrl
        });
        return { type: 'text', text };
      }
      
      case 'pending':
      case 'processing': {
        const text = translationService.translate('report_pending', language, {
          eta: data.eta || 'Expected within 2 hours'
        });
        return { type: 'text', text };
      }

      case 'not_found':
      case 'patient_not_found':
      case 'no_reports_found':
      default: {
        return {
          type: 'text',
          text: translationService.translate('report_not_found', language)
        };
      }
    }
  }

  formatKnowledgeResponse(data, language = 'en') {
    // FAQ / KB answers match context queries, keep answer text directly.
    const text = data.answer || translationService.translate('kb_answer_fallback', language);
    
    if (data.suggestions && data.suggestions.length > 0) {
      const buttons = data.suggestions.slice(0, 3).map((s) => {
        // Map suggestion labels if they match primary menu triggers
        let label = s;
        if (s.toLowerCase().includes('book')) {
          label = translationService.translate('help_menu_btn_book', language);
        } else if (s.toLowerCase().includes('report')) {
          label = translationService.translate('help_menu_btn_report', language);
        } else if (s.toLowerCase().includes('support') || s.toLowerCase().includes('avail')) {
          label = translationService.translate('help_menu_btn_support', language);
        }
        
        return {
          id: s.toUpperCase().replace(/\s+/g, '_'),
          title: label.slice(0, 20)
        };
      });
      return { type: 'buttons', text, buttons };
    }

    return { type: 'text', text };
  }

  formatEscalationResponse(data, language = 'en') {
    if (data.message && !data.ticketId) {
      return {
        type: 'text',
        text: translationService.translate('escalation_ticket_mock', language, { message: data.message })
      };
    }

    const text = translationService.translate('escalation_ticket_created', language, {
      ticketId: data.ticketId || 'N/A',
      status: data.status || 'OPEN',
      priority: data.priority || 'MEDIUM',
      assignedAgent: data.assignedAgent || 'Queue Allocation'
    });
    return { type: 'text', text };
  }
}

const responseFormatter = new ResponseFormatter();
module.exports = { responseFormatter };
