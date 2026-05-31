const express = require('express');
const router = express.Router();
const { getNotifications, markAllAsRead, createNotification } = require('../controllers/notification');

// Get notifications for a specific user
router.get('/user/:userId', getNotifications);
// Mark all user notifications as read
router.put('/user/:userId/read-all', markAllAsRead);
// Admin create notification endpoint
router.post('/create', createNotification);

module.exports = router;