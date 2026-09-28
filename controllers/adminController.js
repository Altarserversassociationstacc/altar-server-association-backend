/**
 * @file adminController.js
 * @description Enterprise Administrative Controller handling provisioning, session management,
 * identity approval pipelines, student lifecycle progression, and dashboard metrics.
 */

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');

// Data Models
const Admin = require('../models/Admin');
const User = require('../models/Student');
const Meeting = require('../models/Meeting');
const Announcement = require('../models/Announcement');
const Event = require('../models/Event');
const Notification = require('../models/Notification');

// ==========================================
// CONFIGURATION & CONSTANTS
// ==========================================

const LEVEL_PROGRESSION = ['100L', '200L', '300L', '400L', '500L'];
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_admin_secret_key';
const TOKEN_EXPIRY = process.env.JWT_EXPIRES_IN || '7d';

// ==========================================
// UTILITIES & HELPERS
// ==========================================

/**
 * Escapes special characters for dynamic RegExp queries.
 * @param {string} text - Raw input string.
 * @returns {string} Sanitized string safe for regular expression matching.
 */
const escapeRegex = (text) => text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

/**
 * Standardized API response dispatcher.
 */
const sendResponse = (res, statusCode, success, message, data = null, extra = {}) => {
  if (!res || typeof res.status !== 'function') {
    console.log(`[System Message]: ${message}`);
    return;
  }
  const payload = { success, message, ...extra };
  if (data !== null) payload.data = data;
  return res.status(statusCode).json(payload);
};

/**
 * Async wrapper eliminating repetitive try-catch blocks in controller routes.
 */
const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error(`❌ [System Error] ${fn.name}:`, err);

    if (typeof next !== 'function') return;
    if (res && res.headersSent) return next(err);

    if (res && typeof res.status === 'function') {
      return res.status(500).json({
        success: false,
        message: 'An unexpected internal server error occurred.',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  });
};

// ==========================================
// HTML TEMPLATE GENERATORS
// ==========================================

const generateApprovalEmailHtml = (user, loginLink, code, magicLink, otpPageLink) => `
  <div style="font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #1f2937; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <h2 style="color: #8b4513; border-bottom: 2px solid #f3f4f6; padding-bottom: 12px; margin-top: 0;">Portal Access Granted</h2>
    <p>Hello <strong>${user.fullName}</strong>,</p>
    <p>Your registration has been formally approved by the administration. To complete your activation, verify your account using the authorization code below:</p>
    <div style="text-align: center; margin: 32px 0;">
      <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; background: #f9fafb; padding: 16px 32px; border-radius: 8px; border: 2px dashed #8b4513; color: #8b4513;">${code}</span>
    </div>
    <div style="text-align: center; margin: 24px 0; display: flex; flex-direction: column; gap: 12px; align-items: center;">
      <a href="${magicLink}" style="display: block; width: 80%; padding: 14px 20px; background-color: #8b4513; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; text-align: center;">Authenticate Automatically</a>
      <a href="${otpPageLink}" style="display: block; width: 80%; padding: 14px 20px; background-color: #ffffff; color: #8b4513; text-decoration: none; border-radius: 6px; font-weight: 600; border: 1px solid #8b4513; text-align: center;">Enter Code Manually</a>
    </div>
    <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
    <p style="font-size: 12px; color: #6b7280; text-align: center;">If buttons are unresponsive, access the portal directly at: <a href="${loginLink}" style="color: #8b4513;">${loginLink}</a></p>
  </div>
`;

const renderErrorScreen = (title, message) => `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | Portal Error</title>
    <style>
      body { font-family: system-ui, -apple-system, sans-serif; background-color: #fef2f2; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
      .card { max-width: 450px; width: 100%; background: #ffffff; padding: 32px; border: 1px solid #fecaca; border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(220, 38, 38, 0.1); text-align: center; }
      h1 { margin: 0 0 16px; font-size: 22px; color: #991b1b; }
      p { font-size: 14px; line-height: 1.6; color: #7f1d1d; margin: 0; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${title}</h1>
      <p>${message}</p>
    </div>
  </body>
  </html>
`;

const renderClearanceScreen = (user) => `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Identity Authorization Interface</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="min-h-screen bg-[#041004] text-gray-100 flex items-center justify-center p-4 antialiased font-sans">
    <div class="w-full max-w-md bg-white text-gray-900 rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
      <div class="bg-[#8b4513] px-6 py-5 text-center text-white">
        <h2 class="text-lg font-bold tracking-wider uppercase text-amber-400">Security Clearance Gateway</h2>
        <p class="text-xs text-amber-100/90 mt-1">Altar Servers Association Portal</p>
      </div>
      <div class="p-6 space-y-6">
        <p class="text-sm text-gray-600 text-center leading-relaxed">
          Verify member registration metadata before authorizing primary workspace privileges.
        </p>
        <div class="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4">
          <div>
            <label class="text-[11px] font-bold text-gray-400 uppercase tracking-widest block">Full Member Name</label>
            <p class="text-lg font-extrabold text-gray-800 mt-0.5">${user.fullName}</p>
          </div>
          <div class="border-t border-gray-200 pt-3">
            <label class="text-[11px] font-bold text-gray-400 uppercase tracking-widest block">Primary Electronic Mail</label>
            <p class="text-base font-semibold text-gray-700 mt-0.5 break-all">${user.email}</p>
          </div>
          <div class="border-t border-gray-200 pt-3">
            <label class="text-[11px] font-bold text-gray-400 uppercase tracking-widest block">Mobile Access Contact</label>
            <p class="text-base font-bold text-emerald-800 mt-0.5">${user.phoneNumber || 'Not provided'}</p>
          </div>
        </div>
        <form action="/api/admin/finalize-approval-execution/${user._id}" method="POST" class="pt-2">
          <button type="submit" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 px-4 rounded-xl shadow-md transition-all duration-150 transform active:scale-95 cursor-pointer text-center text-base tracking-wide">
            Confirm & Authorize Member Access
          </button>
        </form>
        <div class="text-center pt-2">
          <p class="text-[11px] text-gray-400 font-medium uppercase tracking-wide">
            System Administrator Control &copy; ${new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  </body>
  </html>
`;

// ==========================================
// MAIL SERVICE
// ==========================================

const sendStudentEmail = async (user, loginLink, code, magicLink, otpPageLink) => {
  try {
    const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, ASSOCIATION_EMAIL } = process.env;

    if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
      console.warn('⚠️ [Mail Service]: Missing OAuth2 environment configurations. Email skipped.');
      return;
    }

    const oauth2Client = new google.auth.OAuth2(
      GMAIL_CLIENT_ID,
      GMAIL_CLIENT_SECRET,
      'https://developers.google.com/oauthplayground'
    );

    oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const subject = 'Account Approved!';
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
    const htmlContent = generateApprovalEmailHtml(user, loginLink, code, magicLink, otpPageLink);

    const messageParts = [
      `From: Altar Server Association <${ASSOCIATION_EMAIL || 'noreply@association.org'}>`,
      `To: ${user.email}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: ${utf8Subject}`,
      '',
      htmlContent
    ];

    const encodedMessage = Buffer.from(messageParts.join('\n'))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encodedMessage } });
  } catch (error) {
    console.error(`❌ [Mail Service Exception] Failed to dispatch approval email to ${user.email}:`, error.message);
  }
};

// ==========================================
// 1. ADMINISTRATIVE AUTHENTICATION ENGINE
// ==========================================

exports.signup = catchAsync(async (req, res) => {
  const { fullName, email, password } = req.body;

  if (!fullName?.trim() || !email?.trim() || !password) {
    return sendResponse(res, 400, false, 'All parameters (fullName, email, password) are mandatory.');
  }

  if (password.length < 8) {
    return sendResponse(res, 400, false, 'Password must be at least 8 characters long.');
  }

  const normalizedEmail = email.toLowerCase().trim();

  const adminExists = await Admin.findOne({ email: normalizedEmail });
  if (adminExists) {
    return sendResponse(res, 409, false, 'An administrator account with this email already exists.');
  }

  const admin = await Admin.create({
    fullName: fullName.trim(),
    email: normalizedEmail,
    password,
    mustChangePassword: false
  });

  const adminResponse = admin.toObject();
  delete adminResponse.password;

  return sendResponse(res, 201, true, 'Administrative profile provisioned successfully.', adminResponse);
});

exports.login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const invalidMsg = 'Invalid administrative credentials provided.';

  if (!email?.trim() || !password) {
    return sendResponse(res, 400, false, 'Email credentials and password verification strings are required.');
  }

  const cleanEmail = email.toLowerCase().trim();
  const admin = await Admin.findOne({ email: cleanEmail }).select('+password');

  if (!admin) {
    return sendResponse(res, 401, false, invalidMsg);
  }

  const isMatch = await admin.matchPassword(password);
  if (!isMatch) {
    return sendResponse(res, 401, false, invalidMsg);
  }

  const token = jwt.sign(
    { id: admin._id, email: admin.email, role: admin.role || 'admin' },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );

  const adminResponse = admin.toObject();
  delete adminResponse.password;

  return res.status(200).json({
    success: true,
    message: 'Administrative session authenticated successfully.',
    token,
    data: adminResponse
  });
});

exports.changeCredentials = catchAsync(async (req, res) => {
  const { newEmail, newPassword } = req.body;
  const adminId = req.user?.id || req.user?._id?.toString();

  if (!adminId) {
    return sendResponse(res, 401, false, 'Unauthorized session state: Missing administrator profile ID.');
  }

  if (!newEmail?.trim() || !newPassword) {
    return sendResponse(res, 400, false, 'Both structural parameters (newEmail and newPassword) are required.');
  }

  if (newPassword.length < 8) {
    return sendResponse(res, 400, false, 'New password must be at least 8 characters long.');
  }

  const cleanEmail = newEmail.toLowerCase().trim();

  const emailInUse = await Admin.findOne({ email: cleanEmail, _id: { $ne: adminId } });
  if (emailInUse) {
    return sendResponse(res, 400, false, 'Target email address is already assigned to another administrative profile.');
  }

  const admin = await Admin.findById(adminId).select('+password');
  if (!admin) {
    return sendResponse(res, 404, false, 'Administrative context not resolved.');
  }

  const isSamePassword = await admin.matchPassword(newPassword);
  if (isSamePassword) {
    return sendResponse(res, 400, false, 'New password cannot be identical to the temporary default password.');
  }

  admin.email = cleanEmail;
  admin.password = newPassword;
  admin.mustChangePassword = false;

  await admin.save();

  const freshToken = jwt.sign(
    { id: admin._id, email: admin.email, role: admin.role || 'admin' },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );

  const adminResponse = admin.toObject();
  delete adminResponse.password;

  return res.status(200).json({
    success: true,
    message: 'Security credentials hardened successfully. Full dashboard access granted.',
    token: freshToken,
    data: adminResponse
  });
});

exports.findStudentByRegistryId = async (req, res) => {
  try {
    const { lookupKey } = req.params;
    const cleanedKey = decodeURIComponent(lookupKey).trim();
    const student = await User.findOne({
      $or: [
        { _id: cleanedKey.match(/^[0-9a-fA-F]{24}$/) ? cleanedKey : null },
        { regNo: { $regex: new RegExp(`^${cleanedKey}$`, 'i') } }
      ]
    }).select('-password').lean();
    if (!student) return res.status(404).json({ success: false, message: 'No student member matched your query parameters.' });
    return res.status(200).json({ success: true, user: student });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Registry search fault: ' + err.message });
  }
};

exports.getAllStudents = async (req, res) => {
  try {
    const students = await User.find({ role: { $in: ['student', null] } }).select('-password').sort({ fullName: 1 }).lean();
    return res.status(200).json(students);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Roster Retrieval Failure: ' + err.message });
  }
};

exports.getMeetingsList = async (req, res) => {
  try {
    const meetings = await Meeting.find().sort({ eventDate: -1 }).lean();
    return res.status(200).json(meetings);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Ledger Retrieval Failure: ' + err.message });
  }
};

/**
 * @desc     LEGACY METHOD: Handles older verification token clicks cleanly from email links
 * @route    GET /api/admin/approve/:token
 */
exports.approve = async (req, res) => {
  try {
    const { token } = req.params;
    const user = await User.findOne({ verificationToken: token });
    if (!user) {
      return res.status(404).send(renderErrorScreen('Link Invalid', 'This approval link is invalid or has already been used.'));
    }
    if (Date.now() > user.codeExpires) {
      return res.status(400).send(renderErrorScreen('Link Expired', 'This approval link has expired. Please ask the candidate to trigger a resend code.'));
    }

    user.isVerified = true;
    await user.save();

    const loginLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/login`;
    const magicLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/verify-magic/${user.verificationToken}`;
    const otpPageLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/verify-email`;

    await sendStudentEmail(user, loginLink, user.verificationCode, magicLink, otpPageLink);

    await Notification.create({
      recipient: user._id,
      title: "Account Officially Approved 🎉",
      message: "Welcome! Your sanctuary access has been granted by the administration.",
      isRead: false
    });

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    return res.redirect(`${clientUrl}/verify-email?email=${encodeURIComponent(user.email)}&approved=true`);
  } catch (err) {
    return res.status(500).send(renderErrorScreen('System Error', err.message));
  }
};

/**
 * @desc     MODERN METHOD: Renders an explicit confirmation dashboard card to the admin.
 * @route    GET /api/admin/approve-student-direct/:id
 */
exports.approveStudent = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).send(renderErrorScreen('Invalid Parameter', 'The student identification structure format is invalid.'));
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).send(renderErrorScreen('Not Found', 'The requested student registration entry cannot be resolved.'));
    }

    if (user.isVerified) {
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      return res.redirect(`${clientUrl}/verify-email?email=${encodeURIComponent(user.email)}&approved=true`);
    }

    return res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Identity Authorization Interface</title>
        <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
        <style>
          body { background-color: #041004; color: #f3f4f6; font-family: system-ui, -apple-system, sans-serif; }
        </style>
      </head>
      <body class="min-h-screen flex items-center justify-center p-4 antialiased">
        <div class="w-full max-w-md bg-white text-gray-900 rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
          
          <div class="bg-[#8b4513] px-6 py-5 text-center text-white">
            <h2 class="text-lg font-bold tracking-wider uppercase text-amber-400">Security Clearance Gateway</h2>
            <p class="text-xs text-amber-100/90 mt-1">Altar Servers Association Portal Management</p>
          </div>

          <div class="p-6 space-y-6">
            <p class="text-sm text-gray-600 text-center leading-relaxed">
              Verify the biological registration metadata details before validating system activation rights for this user.
            </p>

            <div class="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4">
              <div>
                <label class="text-xs font-bold text-gray-400 uppercase tracking-widest block">Full Account Profile Name</label>
                <p class="text-lg font-extrabold text-gray-800 mt-0.5">${user.fullName}</p>
              </div>
              
              <div class="border-t border-gray-200 pt-3">
                <label class="text-xs font-bold text-gray-400 uppercase tracking-widest block">Primary Electronic Mail</label>
                <p class="text-base font-semibold text-gray-700 mt-0.5 break-all">${user.email}</p>
              </div>

              <div class="border-t border-gray-200 pt-3">
                <label class="text-xs font-bold text-gray-400 uppercase tracking-widest block">Mobile Access Contact</label>
                <p class="text-base font-bold text-emerald-800 mt-0.5">${user.phoneNumber || 'Not provided on signup'}</p>
              </div>
            </div>

            <form action="/api/admin/finalize-approval-execution/${user._id}" method="POST" class="pt-2">
              <button type="submit" class="w-full bg-[#059669] hover:bg-[#047857] text-white font-bold py-4 px-4 rounded-xl shadow-md transition-all duration-150 transform active:scale-[0.99] cursor-pointer text-center text-base tracking-wide">
                Confirm & Authorize Member Access
              </button>
            </form>

            <div class="text-center">
              <p class="text-[11px] text-gray-400 font-medium uppercase tracking-wide">
                System Administrator Node Control &copy; 2026
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    return res.status(500).send(renderErrorScreen('System Error', err.message));
  }
};

/**
 * @desc     EXECUTION ROUTE: Processes data updates following structural admin validation card clicks
 * @route    POST /api/admin/finalize-approval-execution/:id
 */
exports.finalizeApprovalExecution = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).send(renderErrorScreen('Invalid Parameter', 'The structural student identification document format is invalid.'));
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).send(renderErrorScreen('Not Found', 'The requested student record entry could not be resolved.'));
    }

    user.isVerified = true;
    await user.save();

    const loginLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/login`;
    const magicLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/verify-magic/${user.verificationToken}`;
    const otpPageLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/verify-email`;

    await sendStudentEmail(user, loginLink, user.verificationCode, magicLink, otpPageLink);

    await Notification.create({
      recipient: user._id,
      title: "Account Officially Approved 🎉",
      message: "Welcome! Your sanctuary access has been granted by the administration.",
      isRead: false
    });

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    return res.redirect(`${clientUrl}/verify-email?email=${encodeURIComponent(user.email)}&approved=true`);
  } catch (err) {
    return res.status(500).send(renderErrorScreen('Execution Error', err.message));
  }
};

exports.updateStudentStatus = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { accountStatus, reason, updateLevel } = req.body;
    if (!studentId || !studentId.match(/^[0-9a-fA-F]{24}$/)) return res.status(400).json({ success: false, message: 'Invalid targeted tracking parameter.' });

    const student = await User.findById(studentId);
    if (!student) return res.status(404).json({ success: false, message: "Student profile context not found." });

    student.accountStatus = accountStatus;
    student.statusReason = reason || `Transitioned parameters to ${accountStatus}`;

    if (updateLevel) {
      let levelStr = updateLevel.toString().trim().toUpperCase();
      if (!levelStr.endsWith('L')) levelStr = `${levelStr}L`;
      if (LEVEL_PROGRESSION.includes(levelStr)) student.currentLevel = levelStr;
    }
    await student.save();
    return res.status(200).json({ success: true, message: 'Status transformed successfully.', student });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id.match(/^[0-9a-fA-F]{24}$/)) return res.status(400).json({ success: false, message: 'Invalid identification data parameter.' });
    await User.findByIdAndDelete(id);
    await Notification.deleteMany({ recipient: id });
    return res.status(200).json({ success: true, message: 'Registration document purged.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    // 1. Capture the filters sent from the frontend query params
    const { semester, level } = req.query;

    // 2. Build dynamic filter queries
    const studentFilter = { role: { $in: ['student', null] } };
    if (level) {
      studentFilter.currentLevel = level; 
    }

    // Note: If you track announcements or events by semester, you could apply it here too.
    const [totalMembers, activeBroadcasts, upcomingEvents, pendingApprovals] = await Promise.all([
      User.countDocuments(studentFilter),
      Announcement.countDocuments(),
      Event.countDocuments({ eventDate: { $gte: new Date() } }),
      User.countDocuments({ ...studentFilter, isVerified: false })
    ]);

    return res.status(200).json({ totalMembers, activeBroadcasts, upcomingEvents, pendingApprovals });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ==========================================
// 3. ASSEMBLY LIFECYCLE LOGIC (UPDATED WITH CRASH PREVENTION)
// ==========================================

exports.createMeeting = async (req, res) => {
  try {
    const { title, dateString, date, day, semester } = req.body;
    const absoluteDateString = dateString || date;
    if (!title || !absoluteDateString) return res.status(400).json({ success: false, message: 'Title and Date are required.' });

    const parsedDate = new Date(absoluteDateString);

    // 🛡️ CRASH PREVENTION: Ensure the semester strictly matches the DB Enum
    const validSemester = ['Harmattan Semester', 'Rain Semester'].includes(semester) 
      ? semester 
      : 'Harmattan Semester';

    const newMeeting = await Meeting.create({
      title: title.trim(),
      day: day || 'Saturday',
      dateString: absoluteDateString.trim(),
      semester: validSemester, 
      eventDate: isNaN(parsedDate.getTime()) ? Date.now() : parsedDate,
      attendanceList: []
    });
    return res.status(201).json({ success: true, meeting: newMeeting });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.toggleAttendance = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { studentId } = req.body;
    
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) return res.status(404).json({ success: false, message: 'Meeting documentation not found.' });

    // 🛡️ CRASH PREVENTION: Ensure array exists and safely handle ObjectIds vs Strings
    let attendanceArray = meeting.attendanceList || [];
    const isPresent = attendanceArray.some(id => id.toString() === studentId.toString());
    let operationStatus = 'present';

    if (isPresent) {
      attendanceArray = attendanceArray.filter(id => id.toString() !== studentId.toString());
      operationStatus = 'absent';
    } else {
      attendanceArray.push(studentId);
    }


    // 🛡️ CRASH PREVENTION: Bypass schema validation on older models with findByIdAndUpdate
    const updatedMeeting = await Meeting.findByIdAndUpdate(
      meetingId,
      { attendanceList: attendanceArray },
      { returnDocument: 'after' } 
    );
    // Trigger numeric computation recalculation block
    await recalculateAndCacheStudentMetrics(studentId, updatedMeeting.semester);
    
    return res.status(200).json({ success: true, message: `Tracking set to ${operationStatus}`, meeting: updatedMeeting });
  } catch (err) {
    console.error("\n❌ CRITICAL ATTENDANCE CRASH:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc     PROFESSIONAL SEMESTER ABSOLUTE COUNTER ENGINE
 * Completely stripped of qualitative statuses and percentage logic layout.
 * Tracks absolute numerical counts for meetings and masses served.
 */
async function recalculateAndCacheStudentMetrics(studentId, currentSemester) {
  try {
    const targetStudent = await User.findById(studentId);
    if (!targetStudent || targetStudent.accountStatus === 'Dormant') return;

    // 🛡️ Ensure valid semester text format
    const validSemesters = ['Harmattan Semester', 'Rain Semester'];
    const targetSemester = validSemesters.includes(currentSemester) ? currentSemester : 'Harmattan Semester';

    // 1. Calculate absolute meeting attendance count
    const attendedMeetingsInSem = await Meeting.countDocuments({ 
      semester: targetSemester, 
      attendanceList: studentId 
    });

    // 2. Fetch or initialize existing counts safely
    const currentMassesCount = targetStudent.activityMetrics?.massesCount || 0;
    const currentOtherActivitiesCount = targetStudent.activityMetrics?.otherActivitiesCount || 0;

    // 3. Update data layers using pure numbers via safe $set injection
    await User.findByIdAndUpdate(studentId, {
      $set: {
        "activityMetrics.meetingCount": attendedMeetingsInSem,
        "activityMetrics.massesCount": currentMassesCount,
        "activityMetrics.otherActivitiesCount": currentOtherActivitiesCount,
        "activityMetrics.lastEvaluatedSemester": targetSemester
      }
    });
  } catch (err) {
    console.error("[Metric Recalculation Error]:", err.message);
  }
}