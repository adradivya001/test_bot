const fs = require('fs');
const path = require('path');
const { logger } = require('../logger/logger');

class TranslationService {
  constructor() {
    this.locales = {};
    this.loadTranslations();
  }

  loadTranslations() {
    const localeDir = path.join(__dirname, '../locales');
    const languages = ['en', 'hi', 'te'];
    
    languages.forEach(lang => {
      try {
        const filePath = path.join(localeDir, `${lang}.json`);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8');
          this.locales[lang] = JSON.parse(content);
          logger.info(`Loaded locales for language: ${lang}`);
        } else {
          logger.warn(`Locales file not found for language: ${lang}`);
          this.locales[lang] = {};
        }
      } catch (error) {
        logger.error(`Failed to load translation file for ${lang}`, { error: error.message });
        this.locales[lang] = {};
      }
    });
  }

  translate(key, language = 'en', interpolations = {}) {
    const lang = ['en', 'hi', 'te'].includes(language) ? language : 'en';
    
    let text = this.locales[lang]?.[key];
    
    // Fallback to English if key is missing in chosen language
    if (text === undefined) {
      logger.debug(`Translation key missing in language ${lang}: ${key}. Falling back to English.`);
      text = this.locales['en']?.[key];
    }
    
    // Fallback to key name itself if missing in English
    if (text === undefined) {
      logger.warn(`Translation key missing in English fallback: ${key}`);
      text = key;
    }

    // Interpolate variables e.g. {doctorName}
    let formattedText = text;
    Object.keys(interpolations).forEach(k => {
      const value = interpolations[k] !== undefined && interpolations[k] !== null ? interpolations[k] : '';
      formattedText = formattedText.replace(new RegExp(`{${k}}`, 'g'), value);
    });

    return formattedText;
  }
}

const translationService = new TranslationService();
module.exports = { translationService };
