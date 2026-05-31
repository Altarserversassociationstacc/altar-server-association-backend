const User = require('../models/Student');
const Meeting = require('../models/Meeting');
const Notification = require('../models/Notification'); // Added your notification model
const mongoose = require('mongoose');
const { google } = require('googleapis');

// Helper: Send Welcome Email to Student
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
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encodedMessage } });
  } catch (error) {
    console.error("Gmail API Error:", error.message);
    throw new Error("Email delivery failed, but account state was updated.");
  }
};

// @desc    Approve account by admin via email link
exports.approve = async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({ verificationToken: token });
    if (!user) {
      return res.status(404).send('<h1>Invalid or Expired Link</h1><p>This approval link is invalid or has already been used.</p>');
    }

    if (Date.now() > user.codeExpires) {
      return res.status(400).send('<h1>Link Expired</h1><p>This approval link has expired.</p>');
    }

    user.isVerified = true;
    await user.save();

    const loginLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/login`;
    const magicLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/verify-magic/${user.verificationToken}`;
    const otpPageLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/verify-email`;

    // 1. Notify student via official email
    await sendStudentEmail(user, loginLink, user.verificationCode, magicLink, otpPageLink);

    // 2. THE BRIDGE: Create the in-app dashboard notification record
    await Notification.create({
      recipient: user._id,
      title: "Account Officially Approved 🎉",
      message: "Welcome! Your sanctuary access has been granted by the administration. Explore your dashboard settings.",
      isRead: false
    });

    res.status(200).send(`<h1>User Approved!</h1><p>${user.fullName} has been verified successfully. Both email and dashboard notifications have been synchronized.</p>`);
  } catch (err) {
    res.status(500).send('<h1>Approval failed</h1><p>' + err.message + '</p>');
  }
};

/**
 * @desc    Execute a transactional presence check toggle flag for a specific level and semester
 * @route   PUT /api/admin/meetings/:meetingId/toggle-attendance
 * @access  Private (Admin Only)
 */
exports.toggleAttendance = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { studentId } = req.body;

    if (!studentId) {
      return res.status(400).json({ message: 'Target Student ID configuration must be specified.' });
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: 'Target meeting context could not be located.' });
    }

    // Toggle the student inside the array - Use string comparison to avoid ObjectId mismatch issues
    const studentIndex = meeting.attendanceList.findIndex(id => id.toString() === studentId);
    let operationStatus = 'present';

    if (studentIndex > -1) {
      meeting.attendanceList.splice(studentIndex, 1);
      operationStatus = 'absent';
    } else {
      meeting.attendanceList.push(studentId);
    }

    await meeting.save();

    // =================================================================
    // DYNAMIC LEVEL-BASED CALCULATION ENGINE
    // =================================================================
    const targetStudent = await User.findById(studentId);
    if (targetStudent) {
      // Use currentLevel as per your profile completion schema
      const currentLevel = targetStudent.currentLevel || '100L';
      const currentSemester = meeting.semester || 'First Semester';

      // Count ONLY the events belonging to this student's year level and semester
      const totalLevelMeetings = await Meeting.countDocuments({ 
        targetLevel: currentLevel,
        semester: currentSemester
      });

      const attendedLevelMeetings = await Meeting.countDocuments({ 
        targetLevel: currentLevel,
        semester: currentSemester,
        attendanceList: studentId 
      });

      // Calculate localized compliance ratio
      const meetingPercent = totalLevelMeetings > 0 ? Math.round((attendedLevelMeetings / totalLevelMeetings) * 100) : 0;

      // Extract existing metrics
      const massesCount = targetStudent.activityMetrics?.massesCount || 0;
      const otherActivitiesCount = targetStudent.activityMetrics?.otherActivitiesCount || 0;
      
      // Dynamic weeks elapsed calculation for exact sync with student dashboard
      const semesterStartDate = new Date('2026-01-01'); 
      const weeksElapsed = Math.max(1, Math.ceil((Date.now() - semesterStartDate.getTime()) / (1000 * 60 * 60 * 24 * 7)));

      // Institutional Weighting Matrix: 40% Assemblies + 40% Liturgical Masses + 20% Supplementaries
      const massTarget = weeksElapsed * 4;
      const massPercent = massTarget > 0 ? Math.min(100, Math.round((massesCount / massTarget) * 100)) : 0;
      const overallPercent = Math.round((meetingPercent * 0.4) + (massPercent * 0.4) + (Math.min(100, otherActivitiesCount * 10) * 0.2));

      let standing = 'Very Poor';
      if (overallPercent >= 90) standing = 'Very Good';
      else if (overallPercent >= 70) standing = 'Good';
      else if (overallPercent >= 50) standing = 'Poor';

      // Update the student document cache fields cleanly
      await User.findByIdAndUpdate(studentId, {
        $set: {
          "activityMetrics.meetingCount": attendedLevelMeetings,
          "activityMetrics.meetingTotal": totalLevelMeetings,
          "activityMetrics.meetingPercent": meetingPercent,
          "activityMetrics.overallPercent": overallPercent,
          "activityMetrics.standing": standing,
          "activityMetrics.weeksElapsed": weeksElapsed
        }
      });
    }

    return res.status(200).json({ 
      message: `Student tracking status altered to: ${operationStatus}.`, 
      meeting 
    });
  } catch (err) {
    return res.status(500).json({ message: 'Attendance Transaction Failed: ' + err.message });
  }
};