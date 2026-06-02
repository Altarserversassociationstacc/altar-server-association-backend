/**
 * @file administrativeVerificationRoutes.js
 * @description Central verification ingestion routing table for processing administrative token clearances.
 */

const express = require('express');
const router = express.Router();

// Import your admin controller mapping
const adminController = require('../controllers/adminController');

// ==========================================
// ADMINISTRATIVE INITIALIZATION TOKENS
// ==========================================

/**
 * @route   GET /api/admin/approve-student-direct/:id
 * @desc    Verify validation ID signature embedded within an email registration link
 * @access  Public
 */
router.get('/approve-student-direct/:id', adminController.approveStudent);

module.exports = router;