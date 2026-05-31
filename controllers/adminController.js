const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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
// 1. ADMINISTRATIVE AUTHENTICATION ENGINE
// ==========================================

/**
 * @desc    Register a new administrative account profile
 * @route   POST /api/admin/signup
 * @access  Private / System Protected
 */
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

    // Plaintext password passed; handled by the pre-save schema hook atomically
    const admin = await Admin.create({
      fullName: fullName.trim(),
      email: email.toLowerCase().trim(),
      password, 
    });

    // Strip sensitive fields explicitly from the output document instance
    const adminResponse = admin.toObject();
    delete adminResponse.password;

    return res.status(201).json({ 
      success: true,
      message: 'Administrative profile provisioned successfully.', 
      admin: adminResponse 
    });
  } catch (err) {
    console.error('Critical Signup Failure:', err);
    return res.status(500).json({ success: false, message: 'Internal Server Error during registration initialization: ' + err.message });
  }
};

/**
 * @desc    Authenticate administrative profile credentials and yield access token
 * @route   POST /api/admin/login
 * @access  Public
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email credentials and password verification strings are required.' });
    }

    // Force selection on password field since it is hidden by default in the schema
    const admin = await Admin.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid administrative credentials provided.' });
    }

    // Utilize schema method for clean validation matching
    const isMatch = await admin.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid administrative credentials provided.' });
    }

    // Sign Cryptographic Access Bearer Token with role parameters
    const token = jwt.sign(
      { id: admin._id, email: admin.email, role: 'admin' },
      process.env.JWT_SECRET || 'fallback_admin_secret_key',
      { expiresIn: '7d' }
    );

    const adminResponse = admin.toObject();
    delete adminResponse.password;

    return res.status(200).json({ 
      success: true,
      message: 'Administrative session authenticated successfully.', 
      token, 
      admin: adminResponse 
    });
  } catch (err) {
    console.error('Critical Login Failure:', err);
    return res.status(500).json({ success: false, message: 'Internal Server Error during credential validation: ' + err.message });
  }
};

// ==========================================
// 2. DATA REGISTRY ROSTER WORKBOOKS
// ==========================================

/**
 * @desc    Find a specific student via dynamic lookup parameter (Registry ID or Object ID)
 * @route   GET /api/admin/find-student/:lookupKey
 * @access  Private (Admin Only)
 */
exports.findStudentByRegistryId = async (req, res) => {
  try {
    const { lookupKey } = req.params;
    const cleanedKey = decodeURIComponent(lookupKey).trim();

    // Checked for a direct database Hex ID match or registry regex string matches
    const student = await User.findOne({
      $or: [
        { _id: cleanedKey.match(/^[0-9a-fA-F]{24}$/) ? cleanedKey : null },
        { regNo: { $regex: new RegExp(`^${cleanedKey}$`, 'i') } }
      ]
    }).select('-password').lean();

    if (!student) {
      return res.status(404).json({ success: false, message: 'No student member matched your query parameters.' });
    }

    return res.status(200).json({ success: true, user: student });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Registry search fault: ' + err.message });
  }
};

/**
 * @desc    Retrieve the verified list of registered student users
 * @route   GET /api/admin/students
 * @access  Private (Admin Only)
 */
exports.getAllStudents = async (req, res) => {
  try {
    const students = await User.find({ 
      role: { $in: ['student', null] } 
    }).select('-password').sort({ fullName: 1 }).lean();

    return res.status(200).json(students);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Roster Retrieval Failure: ' + err.message });
  }
};

/**
 * @desc    Get all created meeting instances sorted by chronological execution date
 * @route   GET /api/admin/meetings-list
 * @access  Private (Admin Only)
 */
exports.getMeetingsList = async (req, res) => {
  try {
    const meetings = await Meeting.find().sort({ eventDate: -1 }).lean();
    return res.status(200).json(meetings);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Ledger Retrieval Failure: ' + err.message });
  }
};

/**
 * @desc    Directly approve a student member from the admin dashboard
 * @route   PUT /api/admin/approve-student/:id
 * @access  Private (Admin Only)
 */
exports.approveStudent = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid structural student document identifier format.' });
    }

    const student = await User.findByIdAndUpdate(
      id, 
      { $set: { isVerified: true } }, 
      { new: true }
    ).select('-password');
    
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });

    await Notification.create({
      recipient: student._id,
      title: "Account Officially Approved 🎉",
      message: "Welcome! Your sanctuary access has been granted by the administration. Explore your dashboard settings.",
      isRead: false
    });

    return res.status(200).json({ 
      success: true, 
      message: 'Student approved successfully.',
      data: student
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Approval Failed: ' + err.message });
  }
};

/**
 * @desc    Modify student operational lifecycle status (Lock, Unlock, Dormant)
 * @route   PUT /api/admin/update-student-status/:studentId
 * @access  Private (Admin Only)
 */
exports.updateStudentStatus = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { accountStatus, reason, updateLevel } = req.body;

    // Verify valid MongoDB hex structure parameters cleanly
    if (!studentId || !studentId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid structural target validation parameters.' });
    }

    const validStatuses = ['Active', 'Locked', 'Dormant', 'Suspended'];
    if (!validStatuses.includes(accountStatus)) {
      return res.status(400).json({ success: false, message: `Invalid status setup. Must be one of: ${validStatuses.join(', ')}` });
    }

    const student = await User.findById(studentId);
    if (!student) return res.status(404).json({ success: false, message: "Student profile context not found within current records registry." });

    // 🛡️ CRITICAL IT GUARD: Ensure normalcy parameters before permitting Dormancy assignment toggles
    if (accountStatus === 'Dormant' && student.currentLevel !== '400L') {
      return res.status(400).json({ 
        success: false, 
        message: "Dormancy state overrides are strictly reserved for 400L Computer Science students undergoing active industrial training placements." 
      });
    }

    // Commit status fields dynamically
    student.accountStatus = accountStatus;
    student.statusReason = reason || `Administrative status transition configured to ${accountStatus}`;

    // Optional progression level updater
    if (updateLevel) {
      let levelStr = updateLevel.toString().trim().toUpperCase();
      if (!levelStr.endsWith('L')) levelStr = `${levelStr}L`;
      if (LEVEL_PROGRESSION.includes(levelStr)) {
        student.currentLevel = levelStr;
      }
    }

    await student.save();

    // Trigger calculation engine to sync metric values under updated parameters automatically
    const currentSemester = student.activityMetrics?.lastEvaluatedSemester || 'First Semester';
    await recalculateAndCacheStudentMetrics(student._id, currentSemester);

    // Re-query newly written document structure to send back matching payload values
    const updatedStudent = await User.findById(studentId).select('-password').lean();

    return res.status(200).json({
      success: true,
      message: `Account status successfully transformed to ${accountStatus}.`,
      student: updatedStudent
    });
  } catch (err) {
    console.error("❌ Account status modification operation exception:", err);
    return res.status(500).json({ success: false, message: "Admin status override operation dropped: " + err.message });
  }
};

/**
 * @desc    Permanently remove a student record along with cascading relational objects
 * @route   DELETE /api/admin/students/:id
 * @access  Private (Admin Only)
 */
exports.deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    // Direct hexadecimal structural model format string match validation gate
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid hexadecimal student record identification parameters.' });
    }

    const student = await User.findByIdAndDelete(id);
    if (!student) {
      return res.status(404).json({ success: false, message: "Member record context could not be resolved or found." });
    }

    // Clear ghost rows to maintain perfect relational consistency indexes
    await Notification.deleteMany({ recipient: id });

    return res.status(200).json({ 
      success: true, 
      message: `The registration document for ${student.fullName} has been permanently purged.` 
    });
  } catch (err) {
    console.error("❌ Critical Student Purge Record Execution Exception:", err.message);
    return res.status(500).json({ success: false, message: "Deletion execution matrix failure: " + err.message });
  }
};

/**
 * @desc    Retrieve real-time figures for dashboard analytical cards
 * @route   GET /api/admin/dashboard-stats
 * @access  Private (Admin Only)
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const [
      totalMembers,
      activeBroadcasts,
      upcomingEvents,
      notifications,
      pendingApprovals
    ] = await Promise.all([
      User.countDocuments({ role: { $in: ['student', null] } }),
      Announcement.countDocuments(),
      Event.countDocuments({ eventDate: { $gte: new Date() } }),
      Notification.countDocuments(),
      User.countDocuments({ isVerified: false, role: { $in: ['student', null] } })
    ]);

    return res.status(200).json({
      totalMembers,
      activeBroadcasts,
      upcomingEvents,
      notifications,
      pendingApprovals
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Metric Aggregation Failure: ' + err.message });
  }
};

// ==========================================
// 3. ASSEMBLY LIFECYCLE & RATING TRANSACTION LOGIC
// ==========================================

/**
 * @desc    Instantiate a new general assembly attendance ledger session
 * @route   POST /api/admin/meetings
 * @access  Private (Admin Only)
 */
exports.createMeeting = async (req, res) => {
  try {
    const { title, dateString, date, day, semester } = req.body;
    const absoluteDateString = dateString || date;

    if (!title || !absoluteDateString) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing vital fields. Title and Date String are mandatory.' 
      });
    }

    const parsedDate = new Date(absoluteDateString);

    const newMeeting = await Meeting.create({
      title: title.trim(),
      day: day || 'Saturday',
      dateString: absoluteDateString.trim(),
      semester: semester || 'First Semester',
      eventDate: isNaN(parsedDate.getTime()) ? Date.now() : parsedDate,
      attendanceList: []
    });

    return res.status(201).json({ 
      success: true,
      message: 'Meeting session initialized successfully.', 
      meeting: newMeeting 
    });
  } catch (err) {
    console.error("❌ Mongoose Insertion Crash Log:", err.message);
    return res.status(500).json({ success: false, message: 'Database Write Error: ' + err.message });
  }
};

/**
 * @desc    Execute a transactional presence check toggle flag for a student record
 * @route   PUT /api/admin/meetings/:meetingId/toggle-attendance
 * @access  Private (Admin Only)
 */
exports.toggleAttendance = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { studentId } = req.body;

    if (!studentId || !studentId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Target Student ID configuration must be specified validly.' });
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Target meeting documentation context could not be located.' });
    }

    const studentIndex = meeting.attendanceList.indexOf(studentId);
    let operationStatus = 'present';

    if (studentIndex > -1) {
      meeting.attendanceList.splice(studentIndex, 1);
      operationStatus = 'absent';
    } else {
      meeting.attendanceList.push(studentId);
    }

    await meeting.save();

    // Trigger sequential tracking recalculation
    await recalculateAndCacheStudentMetrics(studentId, meeting.semester);

    return res.status(200).json({ 
      success: true,
      message: `Student tracking status altered to: ${operationStatus}.`, 
      meeting 
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Attendance Toggle Transaction Failed: ' + err.message });
  }
};

/**
 * @abstract Background Metrics Recalculation Engine
 * @description Re-computes absolute compliance metrics isolated cleanly within semester boundaries.
 */
async function recalculateAndCacheStudentMetrics(studentId, currentSemester) {
  try {
    const targetStudent = await User.findById(studentId);
    if (!targetStudent) return;

    const targetSemester = currentSemester || 'First Semester';

    // 🛡️ THE DORMANCY GUARD INTERCEPTOR
    if (targetStudent.accountStatus === 'Dormant') {
      await User.findByIdAndUpdate(studentId, {
        $set: { "activityMetrics.standing": 'Dormant (IT Session Sync)' }
      });
      console.log(`🛡️ [IT Dormancy Guard]: Frozen metrics for ${targetStudent.fullName}`);
      return; 
    }

    // 📈 FIXED PRODUCTION FALLBACK INITIALIZATION GATE
    // Safely fallback defaults if activityMetrics schema block hasn't been instantiated yet
    const metricsBase = targetStudent.activityMetrics || {};
    const massesCount = metricsBase.massesCount || 0;
    const otherActivitiesCount = metricsBase.otherActivitiesCount || 0;

    // 📈 SEMESTER-SPECIFIC CALCULATION PARTITION
    const totalMeetingsInSem = await Meeting.countDocuments({ semester: targetSemester });
    const attendedMeetingsInSem = await Meeting.countDocuments({ 
      semester: targetSemester,
      attendanceList: studentId 
    });
    
    const meetingPercent = totalMeetingsInSem > 0 ? Math.round((attendedMeetingsInSem / totalMeetingsInSem) * 100) : 0;

    // Dynamic Semester Audit Timeline calculation anchor
    const semesterStartDate = new Date('2026-01-01'); 
    const weeksElapsed = Math.max(1, Math.ceil((Date.now() - semesterStartDate.getTime()) / (1000 * 60 * 60 * 24 * 7)));

    const massTarget = weeksElapsed * 4; 
    const massPercent = massTarget > 0 ? Math.min(100, Math.round((massesCount / massTarget) * 100)) : 0;
    
    // Institutional Weighting Matrix: 40% Assemblies + 40% Masses + 20% Supplementaries
    const overallPercent = Math.round((meetingPercent * 0.4) + (massPercent * 0.4) + (Math.min(100, otherActivitiesCount * 10) * 0.2));

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
    console.error("❌ Recalculation Core Engine Fault Intercepted:", err.message);
  }
}