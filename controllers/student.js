const mongoose = require('mongoose');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Database Models
const User = require('../models/Student');
const Meeting = require('../models/Meeting');
const Attendance = require('../models/Attendance');
const Assignment = require('../models/Assignment'); // Dynamic metric counter engine import

// Professional Modular Imports
const { sendOAuth2Email } = require('../services/emailService');
const emailTemplates = require('../templates/emailTemplates');

// Array structural definition for institutional year progression
const LEVEL_PROGRESSION = ['100L', '200L', '300L', '400L', '500L'];

// ==========================================
// 1. STUDENT AUTHENTICATION MODULE
// ==========================================

// @desc      Register user and notify admin
// @route     POST /api/student/signup
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

    const BACKEND_BASE = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
    const approveLink = `${BACKEND_BASE.replace(/\/$/, '')}/api/admin/approve-student-direct/${user._id}`;
    
    const magicLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/verify-magic/${verificationToken}`;

    const adminHtml = emailTemplates.getAdminSignupTemplate(user, approveLink);
    const studentHtml = emailTemplates.getStudentVerificationTemplate(verificationCode, magicLink);

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

// @desc      Verify account with code
// @route     POST /api/student/verify
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

// @desc      Resend verification code
// @route     POST /api/student/resend-code
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

// @desc      Verify magic link from email button
// @route     GET /api/student/magic-verify/:token
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

// @desc      Login user with advanced status security boundaries
// @route     POST /api/student/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user || !user.password) return res.status(400).json({ message: 'Invalid credentials' });
    
    if (!user.isVerified) return res.status(403).json({ message: 'Your account has not been approved by an administrator yet.' });
    if (!user.isEmailVerified) return res.status(403).json({ message: 'Please verify your email address using the code sent to you.' });

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

// @desc      Mark attendance for a user
// @route     POST /api/student/attendance/:id
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

// @desc      Send official correspondence email
// @route     POST /api/student/correspondence/:id
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

// @desc      Request to join the WhatsApp community
// @route     POST /api/student/community-request/:id
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

// @desc      Get user activity statistics and automatically evaluate promotions
// @route     GET /api/student/activity-stats/:id
exports.getActivityStats = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    
    if (!user) return res.status(404).json({ message: 'Student record not found.' });

    const semesterStartDate = new Date('2026-01-01'); 
    const weeksElapsed = Math.max(1, Math.ceil((Date.now() - semesterStartDate.getTime()) / (1000 * 60 * 60 * 24 * 7)));

    // const currentLevelStr = user.currentLevel || '100L';
    // const meetings = await Meeting.find({ targetLevel: currentLevelStr }).sort({ date: -1 }).lean();
    //  NEW UPDATED CODE

    const currentLevelStr = user.currentLevel || '100L';

    // Fetching all meetings without the strict targetLevel restriction to open the pipeline
    const meetings = await Meeting.find({}).sort({ date: -1 }).lean(); 

   
    // 🛡️ CRASH PREVENTION 1: Safe attendance parsing
    const meetingTotal = meetings.length || 1;
    const meetingCount = meetings.filter(m => 
      m.attendanceList && m.attendanceList.some(studentId => studentId && studentId.toString() === id)
    ).length;

    const meetingPercent = Math.min(100, Math.round((meetingCount / meetingTotal) * 100)) || 0;

  // ... inside getActivityStats ...

    const meetingLogs = meetings.map(m => ({
      title: m.title,
      // 🛡️ FIX 1: Grab the correct 'eventDate' from the database
      date: m.eventDate || m.dateString || m.createdAt, 
      // 🛡️ FIX 2: Send the semester and level so the calendar's filter dropdowns work
      semester: m.semester || 'Harmattan Semester',
      level: currentLevelStr,
      // 🛡️ FIX 3: Tell the calendar exactly what icon to show
      type: 'Meeting',
      attended: m.attendanceList && m.attendanceList.some(studentId => studentId && studentId.toString() === id)
    }));

    // ... rest of the code ...
    const otherActivitiesCount = await Attendance.countDocuments({ user: id, category: 'Other' });

    // =========================================================================
    // ⚙️ THE BULLETPROOF AGGREGATION ENGINE
    // =========================================================================
    const studentNameClean = user.fullName.trim();
    const escapedName = studentNameClean.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const searchRegex = new RegExp(escapedName, 'i');

    const rolesList = [
      'sacristan', 'masterOfCeremonies', 'firstAcolyte', 'secondAcolyte',
      'crossBearer', 'thurifer', 'boatBearer', 'firstAuxiliary',
      'secondAuxiliary', 'mitreBearer', 'crosierBearer'
    ];

    const searchConditions = [];
    rolesList.forEach(role => {
        searchConditions.push({ [`roles.${role}.name`]: searchRegex }); 
        searchConditions.push({ [role]: searchRegex }); 
    });

    const relevantAssignments = await Assignment.find({ $or: searchConditions }).sort({ assignmentDate: -1 }).lean();

    const massesAllocatedDates = [];
    const massesServedDates = [];

    relevantAssignments.forEach((assignment) => {
      const matchedRoleField = rolesList.find(role => {
          // 🛡️ CRASH PREVENTION 2: Optional Chaining (?.) protects against missing/null roles
          const newName = assignment?.roles?.[role]?.name;
          const oldName = assignment?.[role];
          const nameToTest = newName || oldName;

          return nameToTest && String(nameToTest).toLowerCase().includes(studentNameClean.toLowerCase());
      });

      if (matchedRoleField) {
        const mapKey = matchedRoleField.charAt(0).toUpperCase() + matchedRoleField.slice(1);
        
        // 🛡️ CRASH PREVENTION 3: Safe Level Access
        const roleLevel = assignment?.roles?.[matchedRoleField]?.level || 'Unknown';
        const roleSemester = assignment?.semester || 'Unknown';

        massesAllocatedDates.push({
          assignmentId: assignment._id,
          date: assignment.assignmentDate || assignment.date, 
          title: assignment.massTitle || assignment.title || "Scheduled Mass Service",
          role: mapKey,
          level: roleLevel,
          semester: roleSemester
        });

        if (assignment.attendance) {
          // 🛡️ CRASH PREVENTION 4: Safe Attendance Access
          const statusValue = assignment?.attendance?.[matchedRoleField] || assignment?.attendance?.[mapKey];
          if (statusValue === 'Served') {
            massesServedDates.push({
              assignmentId: assignment._id,
              date: assignment.assignmentDate || assignment.date,
              title: assignment.massTitle || assignment.title || "Served Mass Service",
              role: mapKey,
              level: roleLevel,
              semester: roleSemester
            });
          }
        }
      }
    });

    let massesAllocatedCount = massesAllocatedDates.length;
    let massesServedCount = massesServedDates.length;

    // =========================================================================

    const massTarget = weeksElapsed * 4; 
    const massPercent = Math.min(100, Math.round((massesServedCount / massTarget) * 100)) || 0;

    const overallPercent = Math.round((meetingPercent * 0.4) + (massPercent * 0.4) + (Math.min(100, otherActivitiesCount * 10) * 0.2));

    let standing = 'Very Poor';
    if (overallPercent >= 90) standing = 'Very Good';
    else if (overallPercent >= 70) standing = 'Good';
    else if (overallPercent >= 50) standing = 'Poor';

    return res.status(200).json({
      user, 
      meetingCount, 
      meetingTotal, 
      meetingPercent,
      otherActivitiesCount, 
      massesCount: massesServedCount,      
      massGivenCount: massesAllocatedCount, 
      massesAllocatedDates, 
      massesServedDates,    
      weeksElapsed,
      overallPercent, 
      standing,
      meetingLogs
    });
  } catch (err) {
    console.error("\n❌ CRITICAL CRASH IN ACTIVITY STATS:", err.message);
    return res.status(500).json({ message: 'Server crash: ' + err.message });
  }
};
// ==========================================
// 3. SECURE PROFILE MANAGEMENT MODULE
// ==========================================

// @desc      Request password reset link
// @route     POST /api/student/forgot-password
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

// @desc      Reset password using token
// @route     POST /api/student/reset-password/:token
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

// @desc      Complete user profile after login
// @route     PUT /api/student/complete-profile/:id
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
    return res.status(500).json({ message: 'Server error: ' + err.message });
  }
};

// @desc      Lock user profile to prevent further edits
// @route     PUT /api/student/lock-profile/:id
exports.lockProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    user.accountStatus = 'Locked';
    user.statusReason = 'Student finalized and locked profile bio-data.';
    await user.save();

    return res.status(200).json({ message: 'Profile has been securely locked.', user });
  } catch (err) {
    return res.status(500).json({ message: 'Server error: ' + err.message });
  }
};

// @desc      Delete user account
// @route     DELETE /api/student/delete-account/:id
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

// @desc      Check user verification/approval status matching frontend loops
// @route      GET /api/student/check-status/:email
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
// ✅ Correct version
exports.getLiturgicalToday = async (req, res) => {
  try {
    const response = await axios.get('http://calapi.inadiutorium.cz/api/v0/en/calendars/default/today');
    return res.status(200).json(response.data);
  } catch (err) {
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to proxy liturgical data: ' + err.message 
    });
  }
};