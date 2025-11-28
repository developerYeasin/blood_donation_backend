const db = require('../config/db');

// Helper function for consistent Pagination responses
const getPagination = (page, limit, total) => {
    return {
        currentPage: Number(page),
        itemsPerPage: Number(limit),
        totalItems: Number(total),
        totalPages: Math.ceil(total / limit),
    };
};

// 1. Get Dashboard Statistics
exports.getStats = async (req, res) => {
    try {
        // Execute queries in parallel for performance
        const [userCount] = await db.execute('SELECT COUNT(*) as total FROM users WHERE role = "user"');
        const [requestCount] = await db.execute('SELECT COUNT(*) as total FROM blood_requests');
        const [fulfilledCount] = await db.execute('SELECT COUNT(*) as total FROM blood_requests WHERE status = "Fulfilled"');
        
        // Get 5 most recent users
        const [recentUsers] = await db.execute(
            'SELECT id, full_name, email, created_at FROM users ORDER BY created_at DESC LIMIT 5'
        );

        res.json({
            total_users: userCount[0].total,
            total_requests: requestCount[0].total,
            fulfilled_requests: fulfilledCount[0].total,
            recent_users: recentUsers
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 2. Get All Users (Paginated)
exports.getAllUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        // Fetch Users
        const [users] = await db.query(
            `SELECT id, full_name, email, phone_number, blood_group, role, is_active, created_at 
             FROM users 
             ORDER BY created_at DESC 
             LIMIT ? OFFSET ?`, 
            [limit, offset]
        );

        // Fetch Total Count
        const [countResult] = await db.query('SELECT COUNT(*) as total FROM users');

        res.json({
            data: users,
            pagination: getPagination(page, limit, countResult[0].total)
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 3. Delete/Ban User
exports.deleteUser = async (req, res) => {
    try {
        const userId = req.params.id;
        
        // Safety check: Don't allow deleting your own account
        if (userId == req.user.id) {
            return res.status(400).json({ message: "You cannot delete your own admin account" });
        }

        await db.execute('DELETE FROM users WHERE id = ?', [userId]);
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 4. Get All Blood Requests (Paginated)
exports.getAllRequests = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const [requests] = await db.query(
            `SELECT br.*, u.full_name as requester_name, u.email as requester_email
             FROM blood_requests br
             JOIN users u ON br.requester_user_id = u.id
             ORDER BY br.created_at DESC
             LIMIT ? OFFSET ?`,
            [limit, offset]
        );

        const [countResult] = await db.query('SELECT COUNT(*) as total FROM blood_requests');

        res.json({
            data: requests,
            pagination: getPagination(page, limit, countResult[0].total)
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};