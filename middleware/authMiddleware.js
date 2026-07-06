/**
 * @file authMiddleware.js
 * @description Dual-Entity authentication shield and role-based clearance inspector.
 */

const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Student = require('../models/Student'); 

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];

      if (!process.env.JWT_SECRET) {
        console.error("🚨 [Critical] JWT_SECRET is missing from environment variables.");
        return res.status(500).json({ message: 'Internal server configuration error' });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // 1. Primary Authorization Probe (Admin Check)
      req.admin = await Admin.findById(decoded.id).select('-password');

      // 2. Secondary Safety Bridge Fallback (Student Check)
      if (!req.admin) {
        const studentUser = await Student.findById(decoded.id).select('-password');
        
        if (studentUser) {
          req.admin = studentUser; // Retained to preserve legacy request object mappings
          req.isStudent = true;    // Explicit context flag for identification down the pipeline
        }
      }

      // 3. Absolute Context Final Gate
      if (!req.admin) {
        return res.status(401).json({ message: 'Not authorized, account no longer exists' });
      }

      // 🛠️ THE CRITICAL BRIDGE FIX: 
      // Controllers look for req.user, so we must safely map req.admin to req.user
      req.user = req.admin; 

      return next();
    } catch (error) {
      console.error(`❌ [Auth Error]: ${error.name} - ${error.message}`);
      return res.status(401).json({ 
        message: error.name === 'TokenExpiredError' ? 'Session expired' : 'Not authorized, token invalid' 
      });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }
};

const adminGate = (req, res, next) => {
  // Hard blocker ensuring student identities masquerading as req.admin are denied permission
  if (req.admin && req.admin.role === 'admin' && !req.isStudent) {
    return next();
  }
  
  return res.status(403).json({ 
    success: false, 
    message: 'Access Denied: High-level administrative clearance privileges required.' 
  });
};
const paymentGate = (req, res, next) => {
  // 1. Ensure the user object exists from the 'protect' middleware
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: 'Authentication required for clearance check.' });
  }

  // 2. Bypass check if it's an Admin masquerading or performing administrative overrides
  if (user.role === 'admin' && !req.isStudent) {
    return next();
  }

  // 3. Extract target session/level from request body or query parameters
  const targetYear = req.body.academicYear || req.query.academicYear || "2025/2026";
  const targetLevel = req.body.level || req.user.currentLevel;

  // 4. Inspect the Entitlement Ledger
  const clearanceRecord = user.sessionClearance?.find(
    record => record.academicYear === targetYear && record.level === targetLevel
  );

  // 5. Enforcement Blocker
  if (!clearanceRecord || clearanceRecord.paymentStatus !== 'Unlocked') {
    return res.status(403).json({
      success: false,
      code: 'PAYMENT_REQUIRED',
      message: `Access Denied: Sessional dues for ${targetLevel} (${targetYear}) must be settled to unlock this portal.`
    });
  }

  return next();
};

module.exports = { 
  protect, 
  adminGate,
  paymentGate // 👈 Don't forget to export the new shield
};

