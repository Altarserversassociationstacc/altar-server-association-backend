const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../middleware/authMiddleware');
const executiveController = require('../controllers/executiveController');

// Configure Multer for in-memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- ROUTES ---

// @desc    Upload executive data (individual or group photo)
router.post('/', protect, upload.single('image'), executiveController.createExecutive);

// @desc    Get the current group photo for the landing page
// Note: Keeping static paths like '/group-photo' ABOVE dynamic paths like '/:id' prevents route hijacking
router.get('/group-photo', executiveController.getGroupPhoto);

// @desc    Get all individual executives for a given year
router.get('/', executiveController.getExecutives);

// @desc    Update an executive
router.put('/:id', protect, upload.single('image'), executiveController.updateExecutive);

// @desc    Delete an executive
router.delete('/:id', protect, executiveController.deleteExecutive);

module.exports = router;