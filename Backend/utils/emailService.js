import * as nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendEmail = async (to, subject, text = null, html = null) => {
  const mailOptions = {
    from: process.env.SMTP_USER,
    to,
    subject,
    ...(html ? { html } : { text: text || 'No content' }), // Prefer HTML if provided
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${to}: ${subject}`);
  } catch (error) {
    console.error('❌ Email failed:', error);
    throw error; // so caller can handle it
  }
};

export { sendEmail };
