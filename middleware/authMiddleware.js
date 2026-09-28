const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Student = require('../models/Student');

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access Denied: Missing or malformed authorization token.' 
    });
  }

  const token = authHeader.split(' ')[1];

  if (!process.env.JWT_SECRET) {
    console.error('🚨 [CRITICAL CONFIGURATION ERROR]: JWT_SECRET is undefined in deployment environment variables.');
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server configuration runtime failure.' 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Concurrent entity profiling to avoid synchronous database blocking operations
    const [adminResult, studentResult] = await Promise.allSettled([
      Admin.findById(decoded.id).select('-password').lean(),
      Student.findById(decoded.id).select('-password').lean()
    ]);

    const activeAdmin = adminResult.status === 'fulfilled' ? adminResult.value : null;
    const activeStudent = studentResult.status === 'fulfilled' ? studentResult.value : null;

    if (activeAdmin) {
      req.user = {
        ...activeAdmin,
        id: decoded.id || activeAdmin._id.toString() // Re-inject normalized string ID stripped by .lean()
      };
      req.isAdmin = true;
      req.isStudent = false;

      // Security Lock: Hard boundary forcing admins to change temporary default credentials
      const isRequestingCredentialChange = req.originalUrl.includes('/change-credentials');

      if (activeAdmin.mustChangePassword && !isRequestingCredentialChange) {
        return res.status(403).json({
          success: false,
          code: 'CREDENTIALS_UPDATE_REQUIRED',
          message: 'Security Lock: Mandatory administrative credential update pending. Please update your credentials to continue.'
        });
      }
    } else if (activeStudent) {
      req.user = {
        ...activeStudent,
        id: decoded.id || activeStudent._id.toString()
      };
      req.isAdmin = false;
      req.isStudent = true;
    } else {
      return res.status(401).json({ 
        success: false, 
        message: 'Authorization Terminated: Registered target principal no longer exists in database.' 
      });
    }

    return next();
  } catch (error) {
    console.error(`❌ [Authentication Pipeline Fault]: ${error.name} -> ${error.message}`);

    const isExpired = error.name === 'TokenExpiredError';
    return res.status(401).json({
      success: false,
      code: isExpired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
      message: isExpired ? 'Session timeout reached. Please authenticate again.' : 'Access Denied: Security token validation failed.'
    });
  }
};

const adminGate = (req, res, next) => {
  const allowedRoles = ['admin', 'superadmin'];

  if (req.user && req.isAdmin && allowedRoles.includes(req.user.role)) {
    return next();
  }

  return res.status(403).json({
    success: false,
    code: 'FORBIDDEN_PRIVILEGES',
    message: 'Access Denied: Operation requires elevated administrative privileges.'
  });
};

const paymentGate = (req, res, next) => {
  const { user, isStudent, isAdmin } = req;

  if (!user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access Denied: Valid user session context required for financial appraisal.' 
    });
  }

  // System Administrative Override Bypass Rule
  const allowedAdminRoles = ['admin', 'superadmin'];
  if (isAdmin && allowedAdminRoles.includes(user.role)) {
    return next();
  }

  // Runtime context parameters mapping configuration targets
  const currentYear = new Date().getFullYear();
  const fallbackAcademicYear = `${currentYear}/${currentYear + 1}`;

  const targetYear = req.body?.academicYear || req.query?.academicYear || fallbackAcademicYear;
  const targetLevel = req.body?.level || req.query?.level || user.currentLevel;

  if (!user.sessionClearance || !Array.isArray(user.sessionClearance)) {
    return res.status(403).json({
      success: false,
      code: 'CLEARANCE_LEDGER_MISSING',
      message: 'Access Denied: Financial verification record matrix is empty for this profile.'
    });
  }

  // Query database array structure for matching structural configurations
  const activeClearance = user.sessionClearance.find(
    (record) => record.academicYear === targetYear && record.level === targetLevel
  );

  // Status Check Validation Guard
  if (!activeClearance || activeClearance.paymentStatus !== 'Unlocked') {
    return res.status(403).json({
      success: false,
      code: 'PAYMENT_REQUIRED',
      message: `Access Blocked: Association sessional dues for ${targetLevel} (${targetYear}) must be settled to unlock this portal workspace access.`
    });
  }

  return next();
};

module.exports = {
  protect,
  adminGate,
  paymentGate
};