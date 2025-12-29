import nodemailer from 'nodemailer';

const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined;
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: smtpPort,
  secure: smtpPort === 465, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  debug: true, // Enable debug logging
  logger: true  // Enable built-in logger
});

// Verify transporter configuration at startup (non-blocking)
transporter.verify().then(() => {
  console.log('SMTP transporter verified');
}).catch((err) => {
  console.error('SMTP transporter verification failed:', err && err.message ? err.message : err);
});

const sendEmail = async (to, subject, html) => {
  try {
    console.log(`\n📧 Sending email to ${to}`);
    console.log('Subject:', subject);
    
    const info = await transporter.sendMail({
      from: `"Data Update" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    
    console.log('✉️ Message sent: %s', info.messageId);
    console.log('📨 Preview URL: %s', nodemailer.getTestMessageUrl(info));
    return true;
  } catch (err) {
    console.error(`\n❌ Error sending email to ${to}:`, err);
    return false;
  }
};

export default sendEmail;
