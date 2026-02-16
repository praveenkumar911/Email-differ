import { parsePhoneNumber as libParsePhoneNumber } from 'libphonenumber-js';

/**
 * Parse and validate phone number
 * @param {string} phone - Phone number in any format
 * @returns {object} - { isValid, e164, national, country }
 */
export const parsePhoneNumber = (phone) => {
  if (!phone) {
    return { isValid: false, e164: null, national: null, country: null };
  }

  try {
    const parsed = libParsePhoneNumber(phone);
    
    if (!parsed || !parsed.isValid()) {
      return { isValid: false, e164: null, national: null, country: null };
    }

    return {
      isValid: true,
      e164: parsed.number, // E.164 format: +14155552671
      national: parsed.formatNational(), // National format: (415) 555-2671
      country: parsed.country, // Country code: US
    };
  } catch (error) {
    return { isValid: false, e164: null, national: null, country: null };
  }
};

/**
 * Check if phone number format is valid
 * @param {string} phone - Phone number to validate
 * @returns {boolean}
 */
export const isValidPhoneFormat = (phone) => {
  return parsePhoneNumber(phone).isValid;
};
