const express = require('express');
const router = express.Router();
const { getConversations, getMessages, startChat } = require('../controllers/chatController');
const protect = require('../middleware/authMiddleware');

router.get('/conversations', protect, getConversations);
router.get('/messages/:conversationId', protect, getMessages);
router.post('/start', protect, startChat);

module.exports = router;