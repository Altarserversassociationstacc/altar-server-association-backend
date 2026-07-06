const express = require('express');
const router = express.Router();

// 🧱 Controller Integrations
const { 
  handlePaystackWebhook, 
  verifyTransactionReference,
  getPaymentHistory,
  logPendingTransaction,
  updateFeeMatrix,
  getFeeMatrix
} = require('../controllers/paymentController');

// 🛡️ Security Clearance Shields
const { protect, adminGate } = require('../middleware/authMiddleware');

// ============================================================================
// 🪝 GATEWAY WEBHOOK (Must bypass JSON parsers to retain raw cryptographic buffer)
// ============================================================================
router.post(
  '/webhook', 
  express.raw({ type: 'application/json' }), 
  handlePaystackWebhook
);

// ============================================================================
// 📡 SYSTEM DISCOVERY (Public)
// Frontend accesses this on component mount without auth headers
// ============================================================================
router.get('/fee-matrix', getFeeMatrix);

// ============================================================================
// 🛒 PROTECTED TRANSACTION PIPELINES (Requires Active Session)
// ============================================================================

router.post(
  '/verify', 
  protect, 
  express.json(), 
  verifyTransactionReference
);

// ============================================================================
// 🔐 ELEVATED ADMINISTRATIVE CONTROLS (Requires High-Level Clearance)
// ============================================================================
router.post(
  '/update-fee-matrix', 
  protect, 
  adminGate, 
  express.json(), 
  updateFeeMatrix
);

router.get(
  '/history', 
  protect, 
  adminGate, 
  getPaymentHistory
);

module.exports = router;