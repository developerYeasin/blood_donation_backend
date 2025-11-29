const express = require('express');
const router = express.Router();
const { createPost, getFeed, likePost, commentPost, getComments, likeComment, deletePost } = require('../controllers/feedController');
const protect = require('../middleware/authMiddleware');

router.post('/', protect, createPost);
router.get('/', protect, getFeed);

// --- NEW ROUTES ---
router.post('/like', protect, likePost);
router.post('/comment', protect, commentPost); // Comment or Reply

router.get('/comments/:postId', protect, getComments); // Fetch comments
router.post('/comment/like', protect, likeComment);    // <--- NEW: Like Comment

router.delete('/:id', protect, deletePost);

module.exports = router;