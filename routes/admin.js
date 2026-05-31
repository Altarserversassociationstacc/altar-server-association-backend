/**
 * @file administrativeVerificationRoutes.js
 * @description Central verification ingestion routing table for processing administrative token clearances.
 * Connects directly to unique verification lifecycle handlers (e.g., email activation links).
 */

const express = require('express');
const router = express.Router();

// Destructured import from your target administrative controller file
const { approve } = require('../controllers/admin');

// ==========================================
// ADMINISTRATIVE INITIALIZATION TOKENS
// ==========================================

/**
 * @route   GET /api/admin/approve/:token
 * @desc    Verify validation token signature embedded within an executive invitation or registration link
 * @access  Public (Invoked when an administrator clicks the unique tracking link inside their email inbox)
 */
router.get('/approve/:token', approve);

module.exports = router;