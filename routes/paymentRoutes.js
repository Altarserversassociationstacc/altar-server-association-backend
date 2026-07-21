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

router.post(
  '/webhook', 
  express.raw({ type: 'application/json' }), 
  handlePaystackWebhook
);

router.get('/fee-matrix', getFeeMatrix);

router.post(
  '/verify', 
  protect, 
  express.json(), 
  verifyTransactionReference
);

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