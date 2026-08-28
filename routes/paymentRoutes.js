const express = require('express');
const router = express.Router();
const { 
  initializePayment, 
  handlePaystackWebhook, 
  verifyTransactionReference,
  getPaymentHistory,
  updateFeeMatrix,
  getFeeMatrix
} = require('../controllers/paymentController');
const { protect, adminGate } = require('../middleware/authMiddleware');

// Webhook must process raw body prior to standard JSON parsing
router.post(
  '/webhook', 
  express.raw({ type: 'application/json' }), 
  handlePaystackWebhook
);

// Public / Protected Endpoints
router.get('/fee-matrix', getFeeMatrix);
router.post('/initialize', protect, express.json(), initializePayment);
router.post('/verify', protect, express.json(), verifyTransactionReference);

// Administrative Endpoints
router.post('/update-fee-matrix', protect, adminGate, express.json(), updateFeeMatrix);
router.get('/history', protect, adminGate, getPaymentHistory);

module.exports = router;