// controllers/authController.js
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');

// Helper: Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// 1. REGISTER
exports.register = async (req, res) => {
    try {
        const { full_name, email, password, phone_number, blood_group } = req.body;
        const latitude = req.body.latitude || null;
        const longitude = req.body.longitude || null;
        const address = req.body.address || null;
        const city = req.body.city || null;

        // Check exist
        const [exists] = await db.execute('SELECT email FROM users WHERE email = ?', [email]);
        if (exists.length > 0) return res.status(400).json({ message: 'User already exists' });

        // Hash Password
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Insert
        const [result] = await db.execute(
            `INSERT INTO users (full_name, email, password_hash, phone_number, blood_group, latitude, longitude, address, city) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [full_name, email, password_hash, phone_number, blood_group, latitude, longitude, address, city]
        );

        res.status(201).json({ 
            success: true, 
            token: generateToken(result.insertId),
            user: { id: result.insertId, full_name, email, blood_group } 
        });
    } catch (error) {
        console.log(" error >>  ", error);
        res.status(500).json({ message: error.message });
    }
};

// 2. LOGIN
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) return res.status(400).json({ message: 'Invalid credentials' });

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        // Remove sensitive data
        delete user.password_hash;
        delete user.reset_password_token;

        res.json({ success: true, token: generateToken(user.id), user });
    } catch (error) {
        console.log(" error >>  ", error);
        res.status(500).json({ message: error.message });
    }
};

// 3. FORGOT PASSWORD
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) return res.status(404).json({ message: 'User not found' });

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
        const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
        
        // Save to DB (Expires in 10 mins)
        const expireDate = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        await db.execute('UPDATE users SET reset_password_token = ?, reset_password_expire = ? WHERE email = ?',
            [otpHash, expireDate, email]);

        // Send Email
        const message = `You requested a password reset. Your OTP is: \n\n ${otp}\n\nThis code is valid for 10 minutes.`;

        try {
            await sendEmail({ email: users[0].email, subject: 'Password Reset OTP', message });
            res.json({ success: true, message: 'OTP sent to your email' });
        } catch (err) {
            console.error("Error sending email: ", err);
            await db.execute('UPDATE users SET reset_password_token = NULL, reset_password_expire = NULL WHERE email = ?', [email]);
            return res.status(500).json({ message: 'Email could not be sent. Please try again later.' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 4. RESET PASSWORD
exports.resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        if (!email || !otp || !newPassword) {
            return res.status(400).json({ message: 'Email, OTP, and new password are required.' });
        }

        const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

        const [users] = await db.execute(
            'SELECT * FROM users WHERE email = ? AND reset_password_token = ? AND reset_password_expire > NOW()',
            [email, otpHash]
        );

        if (users.length === 0) {
            return res.status(400).json({ message: 'Invalid or expired OTP.' });
        }

        const user = users[0];

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(newPassword, salt);

        await db.execute(
            'UPDATE users SET password_hash = ?, reset_password_token = NULL, reset_password_expire = NULL WHERE id = ?',
            [password_hash, user.id]
        );

        res.json({ success: true, message: 'Password updated successfully.' });
    } catch (error) {
        console.error("Error resetting password: ", error);
        res.status(500).json({ message: error.message });
    }
};