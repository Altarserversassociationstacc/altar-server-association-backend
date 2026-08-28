/**
 * @file paymentController.js
 * @description Enterprise Paystack integration controller handling dynamic fee calculations,
 * cryptographic webhooks, atomic database state unlocks, and fee matrix configurations.
 */

const crypto = require('crypto');
const axios = require('axios');
const https = require('https');
const mongoose = require('mongoose');

const User = require('../models/Student');
const Payment = require('../models/Payment');
const FeeConfig = require('../models/FeeConfig');

const ipv4Agent = new https.Agent({ family: 4 });

/**
 * ⚙️ PAYSTACK FEE ENGINE CONFIGURATION
 */
const PAYSTACK_RULES = {
  LOCAL_PERCENTAGE: 0.015,
  FLAT_FEE_KOBO: 10000,   // ₦100.00
  CAP_KOBO: 200000,       // ₦2,000.00 cap
  THRESHOLD_KOBO: 250000  // ₦2,500.00 threshold
};

/**
 * 🧮 Inverse Paystack Local Fee Math (Passes transaction fees to client)
 * @param {number} targetAmountNaira 
 * @returns {{ grossKobo: number, grossNaira: number, paystackFeeNaira: number }}
 */
const calculatePaystackLocalFee = (targetAmountNaira) => {
  const targetInKobo = Math.round(targetAmountNaira * 100);
  const { LOCAL_PERCENTAGE, FLAT_FEE_KOBO, CAP_KOBO, THRESHOLD_KOBO } = PAYSTACK_RULES;

  let finalAmountKobo;

  if (targetInKobo < (THRESHOLD_KOBO - (THRESHOLD_KOBO * LOCAL_PERCENTAGE))) {
    finalAmountKobo = targetInKobo / (1 - LOCAL_PERCENTAGE);
  } else {
    finalAmountKobo = (targetInKobo + FLAT_FEE_KOBO) / (1 - LOCAL_PERCENTAGE);
    if ((finalAmountKobo - targetInKobo) > CAP_KOBO) {
      finalAmountKobo = targetInKobo + CAP_KOBO;
    }
  }

  const grossKobo = Math.ceil(finalAmountKobo);
  const grossNaira = Number((grossKobo / 100).toFixed(2));
  const paystackFeeNaira = Number((grossNaira - targetAmountNaira).toFixed(2));

  return { grossKobo, grossNaira, paystackFeeNaira };
};

/**
 * 🛠️ Flexible Metadata Value Extractor
 */
const extractMetadataValue = (metadata, keys, fallback = null) => {
  if (!metadata) return fallback;
  const keyList = Array.isArray(keys) ? keys : [keys];

  for (const key of keyList) {
    if (metadata[key] !== undefined && metadata[key] !== null && String(metadata[key]).trim() !== '') {
      return String(metadata[key]).trim();
    }
  }

  if (Array.isArray(metadata.custom_fields)) {
    for (const key of keyList) {
      const field = metadata.custom_fields.find(
        f => f.variable_name === key || f.display_name?.toLowerCase() === key.toLowerCase()
      );
      if (field && field.value !== undefined && field.value !== null && String(field.value).trim() !== '') {
        return String(field.value).trim();
      }
    }
  }

  return fallback;
};

/**
 * 🔒 Atomic Entitlement Provisioning Engine
 */
const processDatabaseUnlock = async (metadata, reference, amountKobo) => {
  const studentId = extractMetadataValue(metadata, ['studentId', 'student_id']);
  
  if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
    throw new Error(`Invalid or missing student ID in payment metadata: ${studentId}`);
  }

  const narration = extractMetadataValue(metadata, ['narration'], 'Sessional Dues');
  const levelToUnlock = extractMetadataValue(metadata, ['level', 'targetLevel'], '100L');
  const academicYear = extractMetadataValue(metadata, ['academicYear', 'academic_year', 'session', 'year'], 'N/A');
  const session = extractMetadataValue(metadata, ['session', 'academicYear', 'academic_year'], academicYear);
  
  const totalPaidNaira = Number(amountKobo) / 100;
  const baseAmountRaw = extractMetadataValue(metadata, ['base_amount', 'baseAmount', 'amount']);
  const baseAmountNaira = (baseAmountRaw && !isNaN(Number(baseAmountRaw))) 
    ? Number(baseAmountRaw) 
    : totalPaidNaira;
    
  const paystackFeeNaira = Math.max(0, Number((totalPaidNaira - baseAmountNaira).toFixed(2)));

  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();

  try {
    const existingPayment = await Payment.findOne({ reference }).session(dbSession);
    if (existingPayment && existingPayment.status === 'success') {
      await dbSession.abortTransaction();
      return { success: true, message: 'Transaction already processed.', paymentRecord: existingPayment };
    }

    const student = await User.findById(studentId).session(dbSession);
    if (!student) {
      throw new Error(`Student record not found for ID: ${studentId}`);
    }

    const studentName = student.fullName || 
      (student.firstName ? `${student.firstName} ${student.lastName || ''}`.trim() : 'Portal User');

    const paymentRecord = await Payment.findOneAndUpdate(
      { reference },
      {
        $set: {
          studentId,
          studentName,
          amount: baseAmountNaira,
          paystackFee: paystackFeeNaira,
          totalPaid: totalPaidNaira,
          narration,
          targetLevel: levelToUnlock,
          academicYear,
          session,
          status: 'success',
          paidAt: new Date()
        }
      },
      { new: true, upsert: true, session: dbSession }
    );

    if (narration === 'Sessional Dues') {
      const clearanceIndex = student.sessionClearance.findIndex(
        record => record.academicYear === academicYear && record.level === levelToUnlock
      );

      const clearancePayload = {
        paymentStatus: 'Unlocked',
        paymentReference: reference,
        unlockedAt: new Date()
      };

      if (clearanceIndex > -1) {
        Object.assign(student.sessionClearance[clearanceIndex], clearancePayload);
      } else {
        student.sessionClearance.push({
          academicYear,
          level: levelToUnlock,
          ...clearancePayload
        });
      }

      student.currentLevel = levelToUnlock;
      await student.save({ session: dbSession });
    }

    await dbSession.commitTransaction();
    return { success: true, paymentRecord };

  } catch (error) {
    await dbSession.abortTransaction();
    throw error;
  } finally {
    dbSession.endSession();
  }
};

/**
 * 🚀 Initialize Payment Gateway Transaction
 */
exports.initializePayment = async (req, res) => {
  try {
    const { studentId, narration, level = '100L', academicYear = 'N/A', session, amount } = req.body;

    if (!studentId || !narration) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required parameters: studentId and narration." 
      });
    }

    const student = await User.findById(studentId).lean();
    if (!student || !student.email) {
      return res.status(404).json({ 
        success: false, 
        message: "Student record or valid email address not found." 
      });
    }

    let baseAmountNaira = Number(amount);

    if (!baseAmountNaira || baseAmountNaira <= 0) {
      let feeConfig = await FeeConfig.findOne({ 
        narration: narration.trim(), 
        targetLevel: level.trim(), 
        academicYear: academicYear.trim(),
        isActive: true
      }).lean();

      if (!feeConfig) {
        feeConfig = await FeeConfig.findOne({ 
          narration: narration.trim(), 
          isActive: true 
        }).lean();
      }

      if (!feeConfig) {
        return res.status(404).json({ 
          success: false, 
          message: `No rate matrix configured for: ${narration} (${level})` 
        });
      }
      baseAmountNaira = feeConfig.amount;
    }

 // Pass the raw base amount directly to Paystack.
    // Paystack will automatically calculate and add its fee to the customer's checkout screen.
    const grossKobo = baseAmountNaira * 100; 
    const grossNaira = baseAmountNaira;
    const paystackFeeNaira = 0; // Paystack handles this dynamically on their endountNaira);
    const resolvedAcademicYear = (academicYear !== 'N/A' ? academicYear : session || 'N/A').trim();

    const paystackPayload = {
      email: student.email.trim(),
      amount: grossKobo,
      metadata: {
        studentId: String(student._id),
        base_amount: baseAmountNaira,
        baseAmount: baseAmountNaira,
        paystack_fee: paystackFeeNaira,
        total_paid: grossNaira,
        narration: narration.trim(),
        level: level.trim(),
        academicYear: resolvedAcademicYear,
        academic_year: resolvedAcademicYear,
        session: (session || resolvedAcademicYear).trim(),
        custom_fields: [
          { display_name: "Narration", variable_name: "narration", value: narration },
          { display_name: "Level", variable_name: "level", value: level },
          { display_name: "Base Dues (NGN)", variable_name: "base_amount", value: String(baseAmountNaira) },
          { display_name: "Gateway Fee (NGN)", variable_name: "paystack_fee", value: String(paystackFeeNaira) },
          { display_name: "Total Charged (NGN)", variable_name: "total_paid", value: String(grossNaira) }
        ]
      }
    };

    const paystackResponse = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      paystackPayload,
      {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
        timeout: 12000,
        httpsAgent: ipv4Agent
      }
    );

    const { authorization_url, access_code, reference } = paystackResponse.data.data;

    return res.status(200).json({
      success: true,
      authorization_url,
      access_code,
      reference,
      breakdown: {
        baseAmount: baseAmountNaira,
        paystackFee: paystackFeeNaira,
        grossAmount: grossNaira
      }
    });

  } catch (error) {
    console.error(`❌ [Payment Init Error]:`, error.response?.data || error.message);
    return res.status(500).json({ 
      success: false, 
      message: "Gateway initialization failure.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 🪝 Cryptographic Webhook Listener
 */
exports.handlePaystackWebhook = async (req, res) => {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const signature = req.headers['x-paystack-signature'];

    if (!secret || !signature) {
      return res.status(401).send("Missing gateway signature or secret.");
    }

    const rawPayload = Buffer.isBuffer(req.body) 
      ? req.body 
      : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
      
    const hash = crypto.createHmac('sha512', secret).update(rawPayload).digest('hex');

    if (hash.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature))) {
      console.warn("⚠️ [Security Warning]: Invalid webhook signature.");
      return res.status(401).json({ message: 'Signature verification failed.' });
    }

    const event = JSON.parse(rawPayload.toString('utf8'));

    if (event.event === 'charge.success') {
      await processDatabaseUnlock(
        event.data.metadata, 
        event.data.reference, 
        event.data.amount
      );
    }

    return res.status(200).send('Event Procured.');
  } catch (error) {
    console.error(`❌ [Webhook Error]:`, error.message);
    return res.status(500).send('Internal Processing Error');
  }
};

/**
 * 🔍 Manual Transaction Verification Endpoint
 */
exports.verifyTransactionReference = async (req, res) => {
  const { reference } = req.body;
  
  if (!reference) {
    return res.status(400).json({ success: false, message: "Transaction reference required." });
  }

  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, 
      {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
        timeout: 12000,
        httpsAgent: ipv4Agent
      }
    );

    const transactionData = response.data?.data;

    if (transactionData?.status === 'success') {
      const unlockResult = await processDatabaseUnlock(
        transactionData.metadata, 
        transactionData.reference, 
        transactionData.amount
      );
      
      return res.status(200).json({ 
        success: true, 
        message: "Transaction verified and account unlocked.",
        data: unlockResult.paymentRecord
      });
    }

    return res.status(400).json({ success: false, message: "Transaction incomplete on gateway." });
  } catch (error) {
    console.error(`❌ [Verification Error]:`, error.response?.data || error.message);
    return res.status(500).json({ success: false, message: "Gateway synchronization failure." });
  }
};

/**
 * 🎛️ Dynamic Rate Matrix Updater
 */
exports.updateFeeMatrix = async (req, res) => {
  try {
    const { 
      narration, 
      amount, 
      targetLevel = '100L', 
      academicYear = `${new Date().getFullYear()}/${new Date().getFullYear() + 1}` 
    } = req.body;

    if (!narration || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Valid narration string and positive numerical amount required." 
      });
    }

    const updatedConfig = await FeeConfig.findOneAndUpdate(
      { 
        narration: narration.trim(), 
        targetLevel: targetLevel.trim(), 
        academicYear: academicYear.trim() 
      },
      { $set: { amount, isActive: true } },
      { returnDocument: 'after', upsert: true, runValidators: true } 
    );

    return res.status(200).json({ success: true, data: updatedConfig });
  } catch (error) {
    console.error(`❌ [Matrix Update Error]:`, error.message);
    return res.status(500).json({ success: false, message: "Failed to update rate matrix." });
  }
};

/**
 * 📡 Fetch System Fee Configurations
 */
exports.getFeeMatrix = async (req, res) => {
  try {
    const fees = await FeeConfig.find({ isActive: true }).lean();
    return res.status(200).json({ success: true, count: fees.length, data: fees });
  } catch (error) {
    console.error(`❌ [Matrix Fetch Error]:`, error.message);
    return res.status(500).json({ success: false, message: "Failed to retrieve fee matrix." });
  }
};

/**
 * 📊 Admin Ledger Query
 */
exports.getPaymentHistory = async (req, res) => {
  try {
    const history = await Payment.find().sort({ createdAt: -1 }).lean();
    return res.status(200).json({ success: true, count: history.length, data: history });
  } catch (error) {
    console.error(`❌ [Ledger Access Error]:`, error.message);
    return res.status(500).json({ success: false, message: 'Could not fetch ledger history.' });
  }
};