const express = require('express');
const router = express.Router();
const { subscribe, getMyNotifications, markAsRead } = require('../controllers/notificationController');
const protect = require('../middleware/authMiddleware');

router.post('/subscribe', protect, subscribe);      // Save browser token
router.get('/', protect, getMyNotifications);       // Get list for UI
router.put('/read', protect, markAsRead);           // Mark all read
router.put('/read/:id', protect, markAsRead);       // Mark specific read

module.exports = router;