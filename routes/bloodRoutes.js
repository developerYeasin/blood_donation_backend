const express = require('express');
const router = express.Router();
const { createRequest, getRequests } = require('../controllers/bloodController');
const protect = require('../middleware/authMiddleware');

router.post('/', protect, createRequest);
router.get('/', protect, getRequests);

module.exports = router;