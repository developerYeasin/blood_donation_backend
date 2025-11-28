const db = require('../config/db');

// Create Request
exports.createRequest = async (req, res) => {
    try {
        const { patient_name, hospital_name, blood_group_required, units_required, urgency_level, latitude, longitude, contact_number } = req.body;

        const [result] = await db.execute(
            `INSERT INTO blood_requests (requester_user_id, patient_name, hospital_name, blood_group_required, units_required, urgency_level, latitude, longitude, contact_number) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.user.id, patient_name, hospital_name, blood_group_required, units_required, urgency_level, latitude, longitude, contact_number]
        );

        // 1. Find users within 10km who match blood group (Basic logic)
        const [nearbyUsers] = await db.execute(
            `SELECT id, fcm_token FROM users
             WHERE blood_group = ? AND id != ?`,
            [blood_group_required, req.user.id] // Filter by distance in production
        );

        // 2. Send Notifications (Requires 'firebase-admin' or 'web-push' set up)
        // For MVP, just log it.
        // You will implement the actual FCM send in Phase 3.
        console.log(`📢 Sending alerts to ${nearbyUsers.length} potential donors...`);

        res.status(201).json({ message: 'Blood Request Created', id: result.insertId });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get All Active Requests
exports.getRequests = async (req, res) => {
    try {
        const [requests] = await db.execute(
            `SELECT br.*, u.full_name as requester_name, u.avatar_url 
             FROM blood_requests br 
             JOIN users u ON br.requester_user_id = u.id 
             WHERE br.status = 'Pending' 
             ORDER BY br.created_at DESC`
        );
        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};