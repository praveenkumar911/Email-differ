import nodemailer from 'nodemailer';

// Use environment variables for credentials instead of hardcoding
const TRANSPORT_CONFIG = {
  service: process.env.EMAIL_SERVICE || 'Gmail',
  auth: {
    user: process.env.EMAIL_USER || 'praveenkumarpalaboyina@gmail.com',
    pass: process.env.EMAIL_PASS || 'wrxpxannxxsanrmi'
  }
};

//  EXPORT transporter
export const transporter = nodemailer.createTransport(TRANSPORT_CONFIG);

/**
 * Send a registration email
 * @param {string} recipientEmail
 * @param {string} subject
 * @param {string} text
 */
export async function sendRegistrationEmail(recipientEmail, subject, text) {
  const mailOptions = {
    from: process.env.EMAIL_FROM || TRANSPORT_CONFIG.auth.user,
    to: recipientEmail,
    subject,
    text
  };

  const info = await transporter.sendMail(mailOptions);
  return info;
}
