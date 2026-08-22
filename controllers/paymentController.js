/**
 * @file paymentController.js
 * @description Financial ledger management, cryptographic webhook handling, and entitlement provisioning.
 */

const crypto = require('crypto');
const axios = require('axios'); 
const https = require('https');
const mongoose = require('mongoose');
const User = require('../models/Student');
const Payment = require('../models/Payment'); 
const FeeConfig = require('../models/FeeConfig');

// Dedicated IPv4 Agent to stabilize Paystack API ingress/egress requests
const ipv4Agent = new https.Agent({ family: 4 });

/**
 * 🔒 Internal Utility: Entitlement Provisioning
 * Unlocks the student portal and updates the session clearance ledger upon successful transaction verification.
 */
const processDatabaseUnlock = async (metadata, reference, amountKobo) => {
  const { studentId, custom_fields } = metadata || {};
  
  // Safely extract custom fields with fallback protection
  const getCustomField = (name, fallback) => {
    if (!Array.isArray(custom_fields)) return fallback;
    const field = custom_fields.find(
      f => f.variable_name === name || f.display_name?.toLowerCase() === name.toLowerCase()
    );
    // Ensure value is non-null, non-undefined, and non-empty string
    return (field && field.value !== undefined && field.value !== null && String(field.value).trim() !== '')
      ? String(field.value).trim()
      : fallback;
  };

  const narration = getCustomField('narration', 'Sessional Dues');
  const levelToUnlock = getCustomField('level', '100L');
  const academicYear = getCustomField('academic_year', 'N/A');
  const session = getCustomField('session', 'N/A');
  const amountNaira = Number(amountKobo) / 100;

  // 1. Validate Student ID format before database queries
  if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
    console.error(`❌ [Payment Unlock Error]: Invalid or missing studentId: "${studentId}" for reference: ${reference}`);
    throw new Error(`Invalid student ID in payment metadata: ${studentId}`);
  }

  // 2. Check for existing completed payment to ensure idempotency
  const existingPayment = await Payment.findOne({ reference });
  if (existingPayment && existingPayment.status === 'success') {
    console.log(`ℹ️ [Payment] Reference ${reference} already processed. Skipping unlock.`);
    return { success: true, message: 'Already processed' };
  }

  // 3. Fetch Student Name for record
  const student = await User.findById(studentId);
  const studentName = student?.fullName || 'Portal User';

  // 4. Atomic Upsert Payment Record (Prevents race conditions)
  const paymentRecord = await Payment.findOneAndUpdate(
    { reference },
    {
      $set: {
        studentId,
        studentName,
        amount: amountNaira,
        narration,
        targetLevel: levelToUnlock,
        academicYear,
        session,
        status: 'success',
        paidAt: new Date()
      }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  // 5. System Entitlement Unlock (The Clearance Gate)
  if (student && narration === 'Sessional Dues') {
    const clearanceIndex = student.sessionClearance.findIndex(
      record => record.academicYear === academicYear && record.level === levelToUnlock
    );

    const clearanceData = {
      paymentStatus: 'Unlocked',
      paymentReference: reference,
      unlockedAt: new Date()
    };

    if (clearanceIndex > -1) {
      Object.assign(student.sessionClearance[clearanceIndex], clearanceData);
    } else {
      student.sessionClearance.push({
        academicYear,
        level: levelToUnlock,
        ...clearanceData
      });
    }

    // Advance operational state
    student.currentLevel = levelToUnlock;
    await student.save();
    console.log(`✅ [Entitlement Granted]: Student ID ${studentId} unlocked for ${levelToUnlock} (${academicYear}).`);
  }

  return { success: true, paymentRecord };
};

/**
 * 🎛️ Admin Tool: Dynamic Matrix Configuration
 */
exports.updateFeeMatrix = async (req, res) => {
  try {
    const { narration, amount } = req.body;

    if (!narration || typeof amount !== 'number') {
      return res.status(400).json({ success: false, message: "Invalid payload parameters." });
    }

    const updatedConfig = await FeeConfig.findOneAndUpdate(
      { narration },
      { $set: { amount } },
      { returnDocument: 'after', upsert: true } 
    );

    return res.status(200).json({ success: true, data: updatedConfig });
  } catch (error) {
    console.error(`❌ [Matrix Update Error]:`, error);
    return res.status(500).json({ success: false, message: "Failed to sync new rate to configuration registry." });
  }
};

/**
 * 📡 System Utility: Fetch Configuration State
 */
exports.getFeeMatrix = async (req, res) => {
  try {
    const fees = await FeeConfig.find();
    return res.status(200).json({ success: true, data: fees });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to retrieve system fee matrix." });
  }
};

/**
 * 🪝 Cryptographic Webhook Listener
 */
exports.handlePaystackWebhook = async (req, res) => {
  try {
    const secret = process.process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET_KEY;
    const signature = req.headers['x-paystack-signature'];

    if (!secret || !signature) {
      console.error("🚨 [Critical Warning]: Missing Paystack credentials or webhook signature.");
      return res.status(401).send("Unauthorized");
    }

    // Isolate payload buffer for HMAC calculation
    const payloadData = typeof req.body === 'string' || Buffer.isBuffer(req.body) 
      ? req.body 
      : JSON.stringify(req.body);
      
    const hash = crypto.createHmac('sha512', secret).update(payloadData).digest('hex');

    // Secure timing-safe equality check prevents timing attacks
    if (hash.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature))) {
      console.warn("⚠️ [Security Violation]: Cryptographic webhook signature mismatch.");
      return res.status(401).json({ message: 'Cryptographic confirmation verification failed.' });
    }

    const event = typeof req.body === 'string' || Buffer.isBuffer(req.body) 
      ? JSON.parse(req.body.toString()) 
      : req.body;

    if (event.event === 'charge.success') {
      await processDatabaseUnlock(event.data.metadata, event.data.reference, event.data.amount);
    }

    // Acknowledge receipt to prevent gateway retries
    return res.status(200).send('Event Procured.');
  } catch (error) {
    console.error(`❌ [Webhook Interception Error]:`, error.message);
    return res.status(500).send('Internal Server Error');
  }
};

/**
 * 🔍 Manual Gateway Verification Fallback
 */
exports.verifyTransactionReference = async (req, res) => {
  const { reference } = req.body;
  
  if (!reference) {
    return res.status(400).json({ success: false, message: "Transaction reference is required." });
  }

  try {
    const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      timeout: 12000,
      httpsAgent: ipv4Agent
    });

    if (response.data?.data?.status === 'success') {
      await processDatabaseUnlock(
        response.data.data.metadata, 
        response.data.data.reference, 
        response.data.data.amount
      );
      return res.status(200).json({ success: true, message: "Verification pipeline processed successfully." });
    }

    return res.status(400).json({ success: false, message: "Transaction unresolved on server." });
  } catch (error) {
    console.error(`❌ [Manual Verification Error]:`, error.response?.data || error.message);
    return res.status(500).json({ 
      success: false, 
      message: error.message || "System integration synchronization failure." 
    });
  }
};

/**
 * 📊 Administrator Ledger Aggregation
 */
exports.getPaymentHistory = async (req, res) => {
  try {
    const history = await Payment.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: history.length, data: history });
  } catch (error) {
    console.error(`❌ [Ledger Access Error]:`, error);
    return res.status(500).json({ success: false, message: 'Could not access ledger history models.' });
  }
};