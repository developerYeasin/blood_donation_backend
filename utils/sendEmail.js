// utils/sendEmail.js
const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    // For testing, use Mailtrap or Gmail
    const transporter = nodemailer.createTransport({
        service: 'gmail', // or use host/port for other providers
        auth: {
            user: process.env.EMAIL_USER, // Add to .env
            pass: process.env.EMAIL_PASS  // Add to .env
        }
    });

    const message = {
        from: `Blood Donation App <${process.env.EMAIL_USER}>`,
        to: options.email,
        subject: options.subject,
        text: options.message
    };

    await transporter.sendMail(message);
};

module.exports = sendEmail;