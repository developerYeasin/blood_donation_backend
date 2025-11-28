const db = require('../config/db');

// 1. Subscribe Browser/Device
exports.subscribe = async (req, res) => {
    try {
        const { subscription, device_type } = req.body;
        // Upsert logic or simple insert
        await db.execute(
            `INSERT INTO user_devices (user_id, device_type, web_push_subscription) VALUES (?, ?, ?)`,
            [req.user.id, device_type || 'web', JSON.stringify(subscription)]
        );
        res.status(201).json({ message: 'Device subscribed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 2. Get Notification History (For the Bell Icon)
exports.getMyNotifications = async (req, res) => {
    try {
        const [notifs] = await db.execute(
            `SELECT * FROM notifications WHERE recipient_id = ? ORDER BY created_at DESC LIMIT 20`,
            [req.user.id]
        );
        
        // Count unread
        const [counts] = await db.execute(
            `SELECT COUNT(*) as unread FROM notifications WHERE recipient_id = ? AND is_read = FALSE`,
            [req.user.id]
        );

        res.json({
            notifications: notifs,
            unread_count: counts[0].unread
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 3. Mark as Read
exports.markAsRead = async (req, res) => {
    try {
        // If ID provided, mark one. If not, mark all.
        if (req.params.id) {
            await db.execute('UPDATE notifications SET is_read = TRUE WHERE id = ? AND recipient_id = ?', [req.params.id, req.user.id]);
        } else {
            await db.execute('UPDATE notifications SET is_read = TRUE WHERE recipient_id = ?', [req.user.id]);
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};