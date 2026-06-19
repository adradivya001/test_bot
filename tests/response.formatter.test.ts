import { responseFormatter } from '../src/formatter/response.formatter';
import { AppointmentBookingData, DoctorAvailabilityData, ReportStatusData } from '../src/backend/backend.client';

describe('Response Formatter', () => {
  describe('Appointment Booking', () => {
    it('should format with buttons if there are 3 or fewer doctors', () => {
      const data: AppointmentBookingData = {
        status: 'select_doctor',
        doctors: ['Dr. Kumar', 'Dr. Sharma']
      };
      const formatted = responseFormatter.formatAppointmentResponse(data);
      expect(formatted.type).toBe('buttons');
      expect(formatted.buttons).toHaveLength(2);
      expect(formatted.buttons?.[0].title).toBe('Dr. Kumar');
    });

    it('should format with a list if there are more than 3 doctors', () => {
      const data: AppointmentBookingData = {
        status: 'select_doctor',
        doctors: ['Dr. Kumar', 'Dr. Sharma', 'Dr. Patil', 'Dr. Nair']
      };
      const formatted = responseFormatter.formatAppointmentResponse(data);
      expect(formatted.type).toBe('list');
      expect(formatted.list?.sections[0].rows).toHaveLength(4);
      expect(formatted.list?.buttonText).toBe('Choose Doctor');
    });

    it('should format confirmed appointment detail layout', () => {
      const data: AppointmentBookingData = {
        status: 'confirmed',
        appointmentId: 'APT-1234',
        doctor: 'Dr. Kumar',
        date: 'June 9',
        time: '10:00 AM'
      };
      const formatted = responseFormatter.formatAppointmentResponse(data);
      expect(formatted.type).toBe('text');
      expect(formatted.text).toContain('✅ *Appointment Confirmed!*');
      expect(formatted.text).toContain('APT-1234');
      expect(formatted.text).toContain('Dr. Kumar');
    });
  });

  describe('Report Status', () => {
    it('should format a ready report with patient name and download url', () => {
      const data: ReportStatusData = {
        status: 'ready',
        patientName: 'Jane Doe',
        testName: 'Lipid Profile',
        resultSummary: 'Cholesterol: 180 mg/dL',
        downloadUrl: 'https://download.com/123'
      };
      const formatted = responseFormatter.formatReportResponse(data);
      expect(formatted.type).toBe('text');
      expect(formatted.text).toContain('READY');
      expect(formatted.text).toContain('Jane Doe');
      expect(formatted.text).toContain('https://download.com/123');
    });

    it('should format pending report status correctly', () => {
      const data: ReportStatusData = {
        status: 'pending'
      };
      const formatted = responseFormatter.formatReportResponse(data);
      expect(formatted.text).toContain('IN PROGRESS');
    });
  });
});
