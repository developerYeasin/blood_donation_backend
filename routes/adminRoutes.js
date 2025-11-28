const express = require('express');
const router = express.Router();
const { getAllUsers, deleteUser, getStats, getAllRequests } = require('../controllers/adminController');
const protect = require('../middleware/authMiddleware');
const adminOnly = require('../middleware/adminMiddleware');

// GLOBAL MIDDLEWARE FOR THIS ROUTER
// All routes below this line require Login (protect) AND Admin Role (adminOnly)
router.use(protect); 
router.use(adminOnly);

// Dashboard Overview
// GET /api/admin/stats
router.get('/stats', getStats);

// User Management
// GET /api/admin/users?page=1&limit=10
router.get('/users', getAllUsers);

// DELETE /api/admin/users/:id
router.delete('/users/:id', deleteUser);

// Request Management
// GET /api/admin/requests?page=1&limit=10
router.get('/requests', getAllRequests);

module.exports = router;