const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { google } = require('googleapis');

// Data Layer Model Injections
const Admin = require('../models/Admin');
const User = require('../models/Student');
const Meeting = require('../models/Meeting');
const Announcement = require('../models/Announcement');
const Event = require('../models/Event');
const Notification = require('../models/Notification');

// Array structural definition for institutional year progression matches
const LEVEL_PROGRESSION = ['100L', '200L', '300L', '400L', '500L'];

// ==========================================
// INTERNAL EMAIL HELPER ENGINE
// ==========================================
const sendStudentEmail = async (user, loginLink, code, magicLink, otpPageLink) => {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      "https://developers.google.com/oauthplayground"
    );

    oauth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const subject = "Account Approved!";
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #f0f0f0; border-radius: 8px;">
        <h2 style="color: #8b4513; border-bottom: 2px solid #8b4513; padding-bottom: 10px;">Account Approved!</h2>
        <p>Hello <strong>${user.fullName}</strong>,</p>
        <p>Your account has been approved by the admin! To complete your registration, please verify your email using the code below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; background: #f4f4f4; padding: 10px 20px; border-radius: 5px; border: 1px dashed #8b4513; color: #8b4513;">${code}</span>
        </div>
        <p style="text-align: center;">Choose your verification method:</p>
        <div style="text-align: center; margin: 20px 0; display: flex; justify-content: center; gap: 10px;">
          <a href="${magicLink}" style="display: inline-block; padding: 12px 20px; background-color: #8b4513; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 5px;">Automatic Login</a>
          <a href="${otpPageLink}" style="display: inline-block; padding: 12px 20px; background-color: #ffffff; color: #8b4513; text-decoration: none; border-radius: 5px; font-weight: bold; border: 1px solid #8b4513; margin: 5px;">Enter Code Manually</a>
        </div>
        <p>If the buttons above do not work, please visit the portal and use the code provided.</p>
        <p style="font-size: 13px; color: #666;">Once verified, you can access your dashboard here: <a href="${loginLink}" style="color: #8b4513;">${loginLink}</a></p>
      </div>
    `;

    const messageParts = [
      `From: Altar Server Association <${process.env.ASSOCIATION_EMAIL}>`,
      `To: ${user.email}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: ${utf8Subject}`,
      '',
      htmlContent
    ];

    const message = messageParts.join('\n');
    const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encodedMessage } });
  } catch (error) {
    console.error("Gmail API Error:", error.message);
    throw new Error("Email delivery failed, but account state was updated.");
  }
};

// ==========================================
// SHARED VISUAL INTERFACE RESPONSES (HTML)
// ==========================================
const renderApprovalScreen = (user) => `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 550px; margin: 60px auto; padding: 40px; border: 1px solid #c3e6cb; border-radius: 16px; background-color: #d4edda; color: #155724; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
    <div style="text-align: center; margin-bottom: 20px;">
      <span style="font-size: 50px;">🎉</span>
    </div>
    <h1 style="margin-top: 0; font-size: 26px; text-align: center; color: #155724;">Administrative Approval Successful</h1>
    
    <hr style="border: 0; height: 1px; background: #c3e6cb; margin: 25px 0;" />
    
    <div style="font-size: 15px; line-height: 1.6; color: #1c602c;">
      <p style="margin: 10px 0;"><strong>Candidate Name:</strong> ${user.fullName}</p>
      <p style="margin: 10px 0;"><strong>Email Address:</strong> ${user.email}</p>
      <p style="margin: 25px 0 0 0; text-align: center; font-weight: 600; font-size: 14px; background: rgba(255,255,255,0.6); padding: 12px; border-radius: 8px; border: 1px dashed #b1dfbb;">
        The account state has shifted to active. Automated dispatch systems have successfully cleared verification options to the student.
      </p>
    </div>
  </div>
`;

const renderErrorScreen = (title, message) => `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 500px; margin: 50px auto; padding: 30px; text-align: center; border: 1px solid #f5c6cb; border-radius: 12px; background-color: #f8d7da; color: #721c24; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
    <h1 style="margin-top: 0; font-size: 24px;">${title}</h1>
    <hr style="border: 0; height: 1px; background: #f5c6cb; margin: 15px 0;" />
    <p style="font-size: 15px; line-height: 1.5;">${message}</p>
  </div>
`;

// ==========================================
// 1. ADMINISTRATIVE AUTHENTICATION ENGINE
// ==========================================

exports.signup = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    if (!fullName || !email || !password) {
      return res.status(400).json({ success: false, message: 'All operational fields are mandatory.' });
    }
    const adminExists = await Admin.findOne({ email: email.toLowerCase().trim() });
    if (adminExists) {
      return res.status(400).json({ success: false, message: 'An administrator account with this email already exists.' });
    }
    const admin = await Admin.create({
      fullName: fullName.trim(),
      email: email.toLowerCase().trim(),
      password, 
    });
    const adminResponse = admin.toObject();
    delete adminResponse.password;
    return res.status(201).json({ success: true, message: 'Administrative profile provisioned successfully.', admin: adminResponse });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal Server Error: ' + err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email credentials and password verification strings are required.' });
    }
    const admin = await Admin.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!admin) return res.status(401).json({ success: false, message: 'Invalid administrative credentials provided.' });
    const isMatch = await admin.matchPassword(password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid administrative credentials provided.' });

    const token = jwt.sign(
      { id: admin._id, email: admin.email, role: 'admin' },
      process.env.JWT_SECRET || 'fallback_admin_secret_key',
      { expiresIn: '7d' }
    );
    const adminResponse = admin.toObject();
    delete adminResponse.password;
    return res.status(200).json({ success: true, message: 'Administrative session authenticated successfully.', token, admin: adminResponse });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal Server Error: ' + err.message });
  }
};

// ==========================================
// 2. DATA REGISTRY ROSTER WORKBOOKS
// ==========================================

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

    return res.status(200).send(renderApprovalScreen(user));
  } catch (err) {
    return res.status(500).send(renderErrorScreen('System Error', err.message));
  }
};

/**
 * @desc     MODERN METHOD: Handles direct object ID validation links from backend dashboards
 * @route    GET /api/admin/approve-student-direct/:id
 */
exports.approveStudent = async (req, res) => {
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

    return res.status(200).send(renderApprovalScreen(user));
  } catch (err) {
    return res.status(500).send(renderErrorScreen('System Error', err.message));
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
    const [totalMembers, activeBroadcasts, upcomingEvents, pendingApprovals] = await Promise.all([
      User.countDocuments({ role: { $in: ['student', null] } }),
      Announcement.countDocuments(),
      Event.countDocuments({ eventDate: { $gte: new Date() } }),
      User.countDocuments({ isVerified: false, role: { $in: ['student', null] } })
    ]);
    return res.status(200).json({ totalMembers, activeBroadcasts, upcomingEvents, pendingApprovals });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ==========================================
// 3. ASSEMBLY LIFECYCLE LOGIC
// ==========================================

exports.createMeeting = async (req, res) => {
  try {
    const { title, dateString, date, day, semester } = req.body;
    const absoluteDateString = dateString || date;
    if (!title || !absoluteDateString) return res.status(400).json({ success: false, message: 'Title and Date are required.' });

    const parsedDate = new Date(absoluteDateString);
    const newMeeting = await Meeting.create({
      title: title.trim(),
      day: day || 'Saturday',
      dateString: absoluteDateString.trim(),
      semester: semester || 'First Semester',
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

    const studentIndex = meeting.attendanceList.findIndex(id => id.toString() === studentId);
    let operationStatus = 'present';

    if (studentIndex > -1) {
      meeting.attendanceList.splice(studentIndex, 1);
      operationStatus = 'absent';
    } else {
      meeting.attendanceList.push(studentId);
    }
    await meeting.save();
    await recalculateAndCacheStudentMetrics(studentId, meeting.semester);
    return res.status(200).json({ success: true, message: `Tracking set to ${operationStatus}`, meeting });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

async function recalculateAndCacheStudentMetrics(studentId, currentSemester) {
  try {
    const targetStudent = await User.findById(studentId);
    if (!targetStudent || targetStudent.accountStatus === 'Dormant') return;

    const targetSemester = currentSemester || 'First Semester';
    const totalMeetingsInSem = await Meeting.countDocuments({ targetLevel: targetStudent.currentLevel || '100L', semester: targetSemester });
    const attendedMeetingsInSem = await Meeting.countDocuments({ targetLevel: targetStudent.currentLevel || '100L', semester: targetSemester, attendanceList: studentId });
    const meetingPercent = totalMeetingsInSem > 0 ? Math.round((attendedMeetingsInSem / totalMeetingsInSem) * 100) : 0;

    const semesterStartDate = new Date('2026-01-01');
    const weeksElapsed = Math.max(1, Math.ceil((Date.now() - semesterStartDate.getTime()) / (1000 * 60 * 60 * 24 * 7)));
    const massTarget = weeksElapsed * 4;
    const massPercent = massTarget > 0 ? Math.min(100, Math.round(((targetStudent.activityMetrics?.massesCount || 0) / massTarget) * 100)) : 0;

    const overallPercent = Math.round((meetingPercent * 0.4) + (massPercent * 0.4) + (Math.min(100, (targetStudent.activityMetrics?.otherActivitiesCount || 0) * 10) * 0.2));
    let standing = 'Very Poor';
    if (overallPercent >= 90) standing = 'Very Good';
    else if (overallPercent >= 70) standing = 'Good';
    else if (overallPercent >= 50) standing = 'Fair';

    await User.findByIdAndUpdate(studentId, {
      $set: {
        "activityMetrics.meetingCount": attendedMeetingsInSem,
        "activityMetrics.meetingTotal": totalMeetingsInSem,
        "activityMetrics.meetingPercent": meetingPercent,
        "activityMetrics.overallPercent": overallPercent,
        "activityMetrics.standing": standing,
        "activityMetrics.weeksElapsed": weeksElapsed,
        "activityMetrics.lastEvaluatedSemester": targetSemester
      }
    });
  } catch (err) {
    console.error(err);
  }
}