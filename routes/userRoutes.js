const express = require('express');
const router = express.Router();
const { getMe, searchDonors, updateProfile, getMyPosts } = require('../controllers/userController');
const protect = require('../middleware/authMiddleware');

router.get('/me', protect, getMe);
router.get('/search', protect, searchDonors);
router.put('/profile', protect, updateProfile);
router.get('/posts', protect, getMyPosts);

module.exports = router;