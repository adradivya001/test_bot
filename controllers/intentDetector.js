const { INTENTS } = require('../shared/constants');
const { logger } = require('../logger/logger');

class IntentDetector {
  async detectIntent(text) {
    const cleanText = (text || '').toLowerCase().trim();
    logger.debug(`Detecting intent for text: "${cleanText}"`);

    // 1. Human Escalation Check
    if (this.matchesKeywords(cleanText, [
      'human', 'agent', 'support', 'representative', 'operator', 'talk to someone', 'talk to person', 'speak to a real',
      'एजेंट', 'मदद', 'सहायता', 'बात करनी', 'సపోర్ట్', 'మాట్లాడాలి', 'సహాయం', 'ఏజెంట్',
      'matladali', 'baat karni'
    ])) {
      return { intent: INTENTS.HUMAN_ESCALATION, confidence: 1.0 };
    }

    // 2. Appointment Booking Check
    if (this.matchesKeywords(cleanText, [
      'book', 'appointment', 'reserve', 'scheduling', 'new booking', 'fix appointment', 'make appointment',
      'अपॉइंटमेंट', 'बुक करें', 'बुक', 'అపాయింట్మెంట్', 'బుక్ చేయండి', 'బుక్',
      'booking', 'cheyali', 'karna'
    ])) {
      return { intent: INTENTS.APPOINTMENT_BOOKING, confidence: 0.9 };
    }

    // 3. Doctor Availability Check
    if (this.matchesKeywords(cleanText, [
      'available', 'availability', 'when is', 'slots', 'timing for doctor', 'dr kum', 'dr sharm', 'dr patil',
      'उपलब्ध', 'डॉक्टर कब', 'समय', 'स्लॉट', 'అందుబాటులో', 'ఎప్పుడు', 'టైమింగ్స్', 'స్లాట్లు',
      'undha', 'timings'
    ])) {
      return { intent: INTENTS.DOCTOR_AVAILABILITY, confidence: 0.85 };
    }

    // 4. Report Status Check
    if (this.matchesKeywords(cleanText, [
      'report', 'status', 'lab test', 'cbc', 'blood', 'results', 'urine test', 'xray', 'x-ray', 'download test',
      'रिपोर्ट', 'जांच', 'రిపోర్ట్', 'టెస్ట్', 'రిజల్ట్స్',
      'kavali', 'dikhao'
    ])) {
      return { intent: INTENTS.REPORT_STATUS, confidence: 0.9 };
    }

    // 5. Knowledge Query Check
    if (this.matchesKeywords(cleanText, [
      'where', 'location', 'address', 'hours', 'timing', 'services', 'contact', 'hospital info', 'specialties',
      'कहाँ', 'पता', 'लोकेशन', 'ఎక్కడ', 'చిరునామా',
      'kaha', 'ekkada'
    ])) {
      return { intent: INTENTS.KNOWLEDGE_QUERY, confidence: 0.8 };
    }

    // Default fallback
    return { intent: INTENTS.UNKNOWN, confidence: 0.0 };
  }

  matchesKeywords(text, keywords) {
    return keywords.some(keyword => text.includes(keyword));
  }
}

const intentDetector = new IntentDetector();
module.exports = { intentDetector };
