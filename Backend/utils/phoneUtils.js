// utils/phoneUtils.js

import { parsePhoneNumber } from 'libphonenumber-js';

/**
 * Normalizes phone number to E.164 format
 * @param {string} phone - Phone number in any format
 * @returns {string|null} - E.164 formatted phone number or null if invalid
 */
export const normalizeToE164 = (phone) => {
  if (!phone) return null;

  try {
    const parsed = parsePhoneNumber(phone);

    if (!parsed || !parsed.isValid()) {
      return null;
    }

    return parsed.number; // always returns E.164
  } catch (error) {
    return null;
  }
};
