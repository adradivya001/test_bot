import { intentDetector } from '../src/intents/intent.detector';
import { INTENTS } from '../src/shared/constants';

describe('Intent Detector', () => {
  it('should detect APPOINTMENT_BOOKING intent from booking keywords', async () => {
    const texts = [
      'book an appointment',
      'I want to schedule an appointment',
      'please reserve a slot',
      'make appointment'
    ];

    for (const text of texts) {
      const result = await intentDetector.detectIntent(text);
      expect(result.intent).toBe(INTENTS.APPOINTMENT_BOOKING);
      expect(result.confidence).toBeGreaterThan(0.5);
    }
  });

  it('should detect DOCTOR_AVAILABILITY intent', async () => {
    const result = await intentDetector.detectIntent('is Dr. Kumar available tomorrow?');
    expect(result.intent).toBe(INTENTS.DOCTOR_AVAILABILITY);
  });

  it('should detect REPORT_STATUS intent', async () => {
    const result = await intentDetector.detectIntent('check my report status');
    expect(result.intent).toBe(INTENTS.REPORT_STATUS);
  });

  it('should detect HUMAN_ESCALATION intent', async () => {
    const result = await intentDetector.detectIntent('please connect me to a human support agent');
    expect(result.intent).toBe(INTENTS.HUMAN_ESCALATION);
  });

  it('should fallback to UNKNOWN for random text', async () => {
    const result = await intentDetector.detectIntent('hello there');
    expect(result.intent).toBe(INTENTS.UNKNOWN);
  });
});
