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
        // const [nearbyUsers] = await db.execute(
        //     `SELECT id, fcm_token FROM users
        //      WHERE blood_group = ? AND id != ?`,
        //     [blood_group_required, req.user.id] // Filter by distance in production
        // );

        // 2. Send Notifications (Requires 'firebase-admin' or 'web-push' set up)
        // For MVP, just log it.
        // You will implement the actual FCM send in Phase 3.
        // console.log(`📢 Sending alerts to ${nearbyUsers.length} potential donors...`);

        res.status(201).json({ message: 'Blood Request Created', id: result.insertId });
    } catch (error) {
        console.log("error >> ", error);
        res.status(500).json({ message: error.message });
    }
};

// Get All Active Requests
exports.getRequests = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const offset = (page - 1) * pageSize;

        const [requests] = await db.query(
            `SELECT br.*, u.full_name as requester_name, u.avatar_url
             FROM blood_requests br
             JOIN users u ON br.requester_user_id = u.id
             WHERE br.status = 'Pending'
             ORDER BY br.created_at DESC
             LIMIT ? OFFSET ?`,
            [pageSize + 1, offset]
        );
        
        const hasMore = requests.length > pageSize;
        if (hasMore) {
            requests.pop(); // Remove the extra item used to check for more
        }

        res.json({ requests, hasMore, page, pageSize });
    } catch (error) {
        console.log("error >> ", error);
        res.status(500).json({ message: error.message });
    }
};
// DELETE MY REQUEST
exports.deleteRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // 1. Check ownership
        const [reqData] = await db.execute('SELECT requester_user_id FROM blood_requests WHERE id = ?', [id]);
        
        if (reqData.length === 0) return res.status(404).json({ message: 'Request not found' });
        if (reqData[0].requester_user_id !== userId) return res.status(403).json({ message: 'Not authorized' });

        // 2. Delete
        await db.execute('DELETE FROM blood_requests WHERE id = ?', [id]);
        res.json({ message: 'Request deleted' });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};