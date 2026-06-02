const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Database Models
const User = require('../models/Student');
const Meeting = require('../models/Meeting');
const Attendance = require('../models/Attendance');

// Professional Modular Imports
const { sendOAuth2Email } = require('../services/emailService');
const emailTemplates = require('../templates/emailTemplates');

// Array structural definition for institutional year progression
const LEVEL_PROGRESSION = ['100L', '200L', '300L', '400L', '500L'];

// ==========================================
// 1. STUDENT AUTHENTICATION MODULE
// ==========================================

// @desc     Register user and notify admin
// @route    POST /api/student/signup
exports.signup = async (req, res) => {
  try {
    const { fullName, gender, email, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'A user with this email already exists' });
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString(); 
    const verificationToken = crypto.randomBytes(32).toString('hex'); 
    const codeExpires = Date.now() + 24 * 60 * 60 * 1000; 

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = await User.create({
      fullName,
      gender,
      email,
      password: hashedPassword,
      verificationCode,
      verificationToken,
      codeExpires,
      currentLevel: '100L',   // Standard structural default string
      levelInducted: '100L',  // Standard structural default string
      accountStatus: 'Active' // Baseline lifecycle instantiation state
    });

    // ✅ FIXED: Points directly to your new GET endpoint string route matching adminRoutes.js
    const BACKEND_BASE = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
    const approveLink = `${BACKEND_BASE.replace(/\/$/, '')}/api/admin/approve-student-direct/${user._id}`;
    
    const magicLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/verify-magic/${verificationToken}`;

    const adminHtml = emailTemplates.getAdminSignupTemplate(user, approveLink);
    const studentHtml = emailTemplates.getStudentVerificationTemplate(verificationCode, magicLink);

    // Deliver notifications asynchronously 
    sendOAuth2Email('altarserversassociationstacc1@gmail.com', 'Action Required: New Registration Pending Approval', adminHtml);
    sendOAuth2Email(user.email, 'Verify Your Email - Altar Server Association', studentHtml);

    return res.status(201).json({
      message: 'Registration successful! Your account is pending administrator approval.',
      email: user.email
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((val) => val.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    return res.status(500).json({ message: 'Registration failed: ' + err.message });
  }
};

// @desc     Verify account with code
// @route    POST /api/student/verify
exports.verify = async (req, res) => {
  try {
    const { email } = req.body;
    const code = req.params.code || req.body.code;

    if (!code) return res.status(400).json({ message: 'Verification code is required.' });

    const query = email ? { email, verificationCode: code } : { verificationCode: code };
    const user = await User.findOne(query);
    
    if (!user) return res.status(404).json({ message: 'User not found or invalid verification code.' });
    if (Date.now() > user.codeExpires) {
      return res.status(400).json({ message: 'Verification code has expired' });
    }

    user.isEmailVerified = true;
    user.verificationCode = undefined;
    user.codeExpires = undefined;
    await user.save();

    return res.status(200).json({ message: 'Email verified successfully! You can now log in.' });
  } catch (err) {
    return res.status(500).json({ message: 'Verification failed: ' + err.message });
  }
};

// @desc     Resend verification code
// @route    POST /api/student/resend-code
exports.resendCode = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const codeExpires = Date.now() + 24 * 60 * 60 * 1000;

    user.verificationCode = verificationCode;
    user.codeExpires = codeExpires;
    await user.save();

    const magicLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/verify-magic/${user.verificationToken}`;
    const resendHtml = emailTemplates.getStudentVerificationTemplate(verificationCode, magicLink);
    
    sendOAuth2Email(user.email, 'Verify Your Account - ASA', resendHtml);

    return res.status(200).json({ message: 'A new verification code has been sent to your email.' });
  } catch (err) {
    return res.status(500).json({ message: 'Error resending code: ' + err.message });
  }
};

// @desc     Verify magic link from email button
// @route    GET /api/student/magic-verify/:token
exports.magicVerify = async (req, res) => {
  try {
    const { token } = req.params;
    const user = await User.findOne({ 
      verificationToken: token,
      codeExpires: { $gt: Date.now() } 
    });

    if (!user || !user.isVerified) {
      return res.status(400).json({ message: 'Link is invalid, has expired, or account lacks Admin approval.' });
    }

    user.isEmailVerified = true;
    user.verificationCode = undefined;
    user.verificationToken = undefined;
    user.codeExpires = undefined;
    await user.save();

    const loginToken = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '7d' }
    );

    return res.status(200).json({ message: 'Account verified successfully!', token: loginToken, user });
  } catch (err) {
    return res.status(500).json({ message: 'Verification failed: ' + err.message });
  }
};

// @desc     Login user with advanced status security boundaries
// @route    POST /api/student/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user || !user.password) return res.status(400).json({ message: 'Invalid credentials' });
    
    // 1. Core Onboarding Security Guards
    if (!user.isVerified) return res.status(403).json({ message: 'Your account has not been approved by an administrator yet.' });
    if (!user.isEmailVerified) return res.status(403).json({ message: 'Please verify your email address using the code sent to you.' });

    // 2. 🛡️ SOPHISTICATED LIFE-CYCLE INTERCEPTORS
    if (user.accountStatus === 'Suspended') {
      return res.status(403).json({ 
        message: `Access Denied. Your profile is under disciplinary suspension. Reason: ${user.statusReason || 'Contact Administration.'}` 
      });
    }

    if (user.accountStatus === 'Dormant') {
      return res.status(403).json({ 
        message: 'Your portal is currently Dormant because you are on 400L Industrial Training (IT). Please message the Admin to reactivate your portal once your session resumes.' 
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    user.password = undefined;

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '7d' }
    );

    return res.status(200).json({ 
      message: 'Login successful', 
      user, 
      token 
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error: ' + err.message });
  }
};

// ==========================================
// 2. DATA TRANSACTIONS & PERFORMANCE RECORDINGS
// ==========================================

// @desc     Mark attendance for a user
// @route    POST /api/student/attendance/:id
exports.markAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { category, description } = req.body;

    const newAttendance = await Attendance.create({ user: id, category, description });
    return res.status(201).json({ message: 'Attendance logged successfully', attendance: newAttendance });
  } catch (err) {
    return res.status(500).json({ message: 'Server error: ' + err.message });
  }
};

// @desc     Send official correspondence email
// @route    POST /api/student/correspondence/:id
exports.sendCorrespondence = async (req, res) => {
  try {
    const { id } = req.params;
    const { recipient, subject, message } = req.body;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const correspondenceHtml = emailTemplates.getCorrespondenceTemplate(user, recipient, subject, message);
    await sendOAuth2Email(process.env.ASSOCIATION_EMAIL, `ASA Correspondence: ${subject}`, correspondenceHtml, user.email);

    return res.status(200).json({ message: 'Correspondence sent successfully!' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to send message: ' + err.message });
  }
};

// @desc     Request to join the WhatsApp community
// @route    POST /api/student/community-request/:id
exports.requestCommunityAccess = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.communityRequest === 'pending') return res.status(400).json({ message: 'Your request is already pending.' });
    if (user.communityRequest === 'approved') return res.status(400).json({ message: 'Your request has already been approved.' });

    user.communityRequest = 'pending';
    await user.save();

    return res.status(200).json({ message: 'Your request to join the community has been sent to the Admin!', user });
  } catch (err) {
    return res.status(500).json({ message: 'Server error: ' + err.message });
  }
};

// @desc     Get user activity statistics and automatically evaluate promotions
// @route    GET /api/student/activity-stats/:id
exports.getActivityStats = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ student record not found.' });

    const semesterStartDate = new Date('2026-01-01'); 
    const weeksElapsed = Math.max(1, Math.ceil((Date.now() - semesterStartDate.getTime()) / (1000 * 60 * 60 * 24 * 7)));

    const currentLevelStr = user.currentLevel || '100L';
    const meetings = await Meeting.find({ targetLevel: currentLevelStr }).sort({ date: -1 }).lean();
    
    const meetingTotal = meetings.length || 1;
    const meetingCount = meetings.filter(m => 
      m.attendanceList?.some(studentId => studentId.toString() === id)
    ).length;

    const meetingPercent = Math.min(100, Math.round((meetingCount / meetingTotal) * 100)) || 0;

    const meetingLogs = meetings.map(m => ({
      title: m.title,
      date: m.date,
      attended: m.attendanceList?.some(studentId => studentId.toString() === id)
    }));

    const activityCounts = await Attendance.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(id) } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    let massesCount = 0, otherActivitiesCount = 0;

    activityCounts.forEach(item => {
      if (item._id === 'Mass') massesCount = item.count;
      if (item._id === 'Other') otherActivitiesCount = item.count;
    });
    
    const massTarget = weeksElapsed * 4; 
    const massPercent = Math.min(100, Math.round((massesCount / massTarget) * 100)) || 0;

    const overallPercent = Math.round((meetingPercent * 0.4) + (massPercent * 0.4) + (Math.min(100, otherActivitiesCount * 10) * 0.2));

    let standing = 'Very Poor';
    if (overallPercent >= 90) standing = 'Very Good';
    else if (overallPercent >= 70) standing = 'Good';
    else if (overallPercent >= 50) standing = 'Poor';

    return res.status(200).json({
      user, meetingCount, meetingTotal, meetingPercent,
      otherActivitiesCount, massesCount, weeksElapsed,
      overallPercent, standing,
      meetingLogs
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error: ' + err.message });
  }
};

// ==========================================
// 3. SECURE PROFILE MANAGEMENT MODULE
// ==========================================

// @desc     Request password reset link
// @route    POST /api/student/forgot-password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'No user found with that email address.' });

    const resetToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; 
    await user.save();

    const resetLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password/${resetToken}`;
    const resetHtml = emailTemplates.getForgotPasswordTemplate(user.fullName, resetLink);

    sendOAuth2Email(user.email, 'Password Reset Request', resetHtml);

    return res.status(200).json({ message: 'A password reset link has been sent to your email.' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error: ' + err.message });
  }
};

// @desc     Reset password using token
// @route    POST /api/student/reset-password/:token
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) return res.status(400).json({ message: 'Password reset token is invalid or has expired.' });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.status(200).json({ message: 'Password has been successfully reset. You can now log in.' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error: ' + err.message });
  }
};

// @desc     Complete user profile after login with defensive input scrubbing and state interceptors
// @route    PUT /api/student/complete-profile/:id
exports.completeProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    
    if (user.accountStatus === 'Suspended') {
      return res.status(403).json({ message: `Operation rejected. Your profile is under disciplinary suspension: ${user.statusReason}` });
    }
    if (user.accountStatus === 'Dormant') {
      return res.status(403).json({ message: 'Operation rejected. This account is currently dormant for 400L Industrial Training.' });
    }
    if (user.accountStatus === 'Locked') {
      return res.status(403).json({ message: 'Your profile details have been securely finalized and locked for this session.' });
    }

    const fields = [
      'fullName', 'profilePicture', 'dateOfBirth', 'phoneNumber', 'regNo',
      'schoolResidentialAddress', 'department', 'currentLevel', 'levelInducted',
      'stateOfOrigin', 'homeTown', 'permanentResidence', 'homeDiocese'
    ];

    fields.forEach(field => {
      if (req.body[field] !== undefined && req.body[field] !== '') {
        let value = req.body[field];
        
        if (['currentLevel', 'levelInducted'].includes(field) && value) {
          let valueStr = value.toString().trim().toUpperCase();
          if (!valueStr.endsWith('L')) {
            valueStr = `${valueStr}L`;
          }
          value = valueStr;
        }

        user[field] = value;
      } else if (['currentLevel', 'levelInducted'].includes(field)) {
        user[field] = user[field] || '100L';
      }
    });

    user.isProfileComplete = true;
    await user.save();

    return res.status(200).json({ message: 'Profile completed successfully!', user });
  } catch (err) {
    console.error("❌ [Complete Profile Validation Failure]:", err.message);
    return res.status(500).json({ message: 'Server validation exception error: ' + err.message });
  }
};

// @desc     Comprehensive evaluation endpoint to manage lock state boundaries and promotion conditions
// @route    GET /api/student/profile-status/:id
exports.getProfileStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const student = await User.findById(id);
    if (!student) return res.status(404).json({ success: false, message: "Student context missing." });

    if (student.accountStatus === 'Suspended' || student.accountStatus === 'Dormant') {
      return res.status(403).json({
        success: false,
        statusBlocked: true,
        accountStatus: student.accountStatus,
        message: student.statusReason || "Access restricted by administrative panel context configuration."
      });
    }

    const semesterStartDate = new Date('2026-01-01');
    const weeksElapsed = Math.max(1, Math.ceil((Date.now() - semesterStartDate.getTime()) / (1000 * 60 * 60 * 24 * 7)));
    
    const currentLevelStr = student.currentLevel || '100L';
    const meetings = await Meeting.find({ targetLevel: currentLevelStr }).lean();

    const meetingTotal = meetings.length || 1;
    const meetingCount = meetings.filter(m => m.attendanceList?.map(sid => sid.toString()).includes(id)).length;
    const meetingPercent = Math.min(100, Math.round((meetingCount / meetingTotal) * 100)) || 0;

    const activityCounts = await Attendance.aggregate([
      { $match: { user: mongoose.Types.ObjectId.createFromHexString(id) } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    let massesCount = 0, otherActivitiesCount = 0;
    activityCounts.forEach(item => { 
      if (item._id === 'Mass') massesCount = item.count; 
      if (item._id === 'Other') otherActivitiesCount = item.count; 
    });
    
    const massTarget = weeksElapsed * 4;
    const massPercent = Math.min(100, Math.round((massesCount / massTarget) * 100)) || 0;

    const overallPercent = Math.round((meetingPercent * 0.4) + (massPercent * 0.4) + (Math.min(100, otherActivitiesCount * 10) * 0.2));

    let promptUnlockModal = false;
    const currentIdx = LEVEL_PROGRESSION.indexOf(currentLevelStr);
    
    const isCardActivated = student.membershipCard?.activation === 'Active' || student.membershipCard?.status === 'Paid';

    if (overallPercent >= 70 && currentIdx < LEVEL_PROGRESSION.length - 1) {
      if (isCardActivated) {
        const nextLevel = LEVEL_PROGRESSION[currentIdx + 1];
        student.currentLevel = nextLevel;
        student.accountStatus = 'Active'; 
        student.statusReason = `System auto-promoted account session ledger to ${nextLevel}`;
        await student.save();
      } else {
        promptUnlockModal = true;
      }
    }

    return res.status(200).json({
      success: true,
      promptUnlockModal,
      accountStatus: student.accountStatus, 
      data: student
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Status processing transaction failure: " + err.message });
  }
};

// @desc     Lock user profile to prevent further edits
// @route    PUT /api/student/lock-profile/:id
exports.lockProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    if (user.accountStatus === 'Suspended' || user.accountStatus === 'Dormant') {
      return res.status(403).json({ message: 'Cannot modify lock states while account status is administratively restricted.' });
    }

    user.accountStatus = 'Locked';
    user.statusReason = 'Student finalized and locked profile bio-data.';
    await user.save();

    return res.status(200).json({ message: 'Profile has been securely locked.', user });
  } catch (err) {
    return res.status(500).json({ message: 'Server error: ' + err.message });
  }
};

// @desc     Delete user account
// @route    DELETE /api/student/delete-account/:id
exports.deleteAccount = async (req, res) => {
  try {
    const { id } = req.params;
    
    await Promise.all([
      Attendance.deleteMany({ user: id }),
      User.findByIdAndDelete(id)
    ]);

    return res.status(200).json({ message: 'Account deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error: ' + err.message });
  }
};

// @desc     Check user verification/approval status matching frontend loops
// @route     GET /api/student/check-status/:email
exports.checkStatus = async (req, res) => {
  try {
    const { email } = req.params;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.status(200).json({
      success: true,
      isEmailVerified: user.isEmailVerified,
      isAdminApproved: user.isVerified 
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error: ' + err.message });
  }
};