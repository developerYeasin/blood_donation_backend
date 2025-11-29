const express = require('express');
const router = express.Router();
const { createRequest, getRequests, deleteRequest } = require('../controllers/bloodController');
const protect = require('../middleware/authMiddleware');

router.post('/', protect, createRequest);
router.get('/', protect, getRequests);

router.delete('/:id', protect, deleteRequest);

module.exports = router;