const db = require('../config/db');

const adminOnly = async (req, res, next) => {
    try {
        // req.user is populated by the 'protect' middleware (authMiddleware)
        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        // Check the database to confirm the user is an admin
        const [users] = await db.execute('SELECT role FROM users WHERE id = ?', [req.user.id]);
        
        if (users.length > 0 && users[0].role === 'admin') {
            next();
        } else {
            res.status(403).json({ message: 'Access denied. Admins only.' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error during admin check' });
    }
};

module.exports = adminOnly;