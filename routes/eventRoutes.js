const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const upload = require('../middleware/upload'); // Ensure this middleware is configured for Mulder
const { protect } = require('../middleware/authMiddleware');

// Public access
router.get('/', eventController.getEvents);

// Protected admin access
router.post('/', protect, upload.single('image'), eventController.createEvent);
router.put('/:id', protect, upload.single('image'), eventController.updateEvent);
router.delete('/:id', protect, eventController.deleteEvent);

module.exports = router;