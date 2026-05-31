/**
 * @file assignmentController.js
 * @description Central controller engine handling plain-text liturgical deployments, 
 * historical roster workbook queries, multi-field regex string search filters, and live attendance metrics updates.
 */

const Assignment = require('../models/Assignment');

/**
 * @desc    Commit a typed liturgical roster map into database records
 * @route   POST /api/admin/mass-assignments
 * @access  Private (Admin Role Enforced)
 */
exports.createAssignment = async (req, res) => {
  try {
    const { assignmentDate, assignmentTime, massTitle, serviceType, hasSecondAcolyte } = req.body;

    // 1. STRICTOR VALIDATION GATES
    if (!assignmentDate || !assignmentTime || !massTitle || !serviceType) {
      return res.status(400).json({ 
        success: false, 
        message: 'Required liturgical configuration metadata parameters are missing.' 
      });
    }

    // 2. PREVENT TIMETABLE OVERWRITE COLLISIONS
    const collisionCheck = await Assignment.findOne({ assignmentDate, assignmentTime });
    if (collisionCheck) {
      return res.status(400).json({ 
        success: false, 
        message: `A sanctuary configuration is already broadcasted for ${assignmentDate} at ${assignmentTime}.` 
      });
    }

    // 3. SECURE TEXT STRIPPER & CONDITIONAL CLEANUP
    const structuralPayload = {
      massTitle: massTitle.trim(),
      assignmentDate,
      assignmentTime,
      serviceType,
      hasSecondAcolyte,
      sacristan: req.body.sacristan?.trim() || '',
      masterOfCeremonies: req.body.masterOfCeremonies?.trim() || '',
      firstAcolyte: req.body.firstAcolyte?.trim() || '',
      secondAcolyte: hasSecondAcolyte ? (req.body.secondAcolyte?.trim() || '') : '',
      crossBearer: req.body.crossBearer?.trim() || '',
      thurifer: req.body.thurifer?.trim() || '',
      boatBearer: req.body.boatBearer?.trim() || '',
      firstAuxiliary: req.body.firstAuxiliary?.trim() || '',
      secondAuxiliary: req.body.secondAuxiliary?.trim() || '',
      mitreBearer: serviceType === 'Bishop Mass' ? (req.body.mitreBearer?.trim() || '') : '',
      crosierBearer: serviceType === 'Bishop Mass' ? (req.body.crosierBearer?.trim() || '') : '',
      deployedByAdmin: req.admin?.id || req.user?.id || null 
    };

    // 4. PERSIST TO MONGO DATABASE CLUSTER
    const deploymentRecord = await Assignment.create(structuralPayload);

    return res.status(201).json({
      success: true,
      message: '📊 Sanctuary deployment sheet finalized and saved successfully!',
      data: deploymentRecord
    });

  } catch (err) {
    console.error('❌ Liturgical Engine Commit Collision:', err.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Database storage breakdown on assignment matrix: ' + err.message 
    });
  }
};

/**
 * @desc    Fetch comprehensive deployment sheets history for dashboards
 * @route   GET /api/admin/mass-assignments/history
 * @access  Private (Admin & Authenticated Accounts)
 */
exports.getAssignmentHistory = async (req, res) => {
  try {
    const deploymentHistory = await Assignment.find()
      .sort({ assignmentDate: -1, assignmentTime: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: deploymentHistory.length,
      data: deploymentHistory
    });
  } catch (err) {
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to synchronize schedule sheets lookup history: ' + err.message 
    });
  }
};

/**
 * @desc    Search engine to track assignments matching a specific string name
 * @route   GET /api/student/my-assignments/search
 * @access  Private (Authenticated Accounts)
 */
exports.searchAssignmentsByStudentName = async (req, res) => {
  try {
    const { name } = req.query;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Provide a text search parameter query.' });
    }

    const searchRegex = new RegExp(name.trim(), 'i');
    
    const matchedLogs = await Assignment.find({
      $or: [
        { sacristan: searchRegex },
        { masterOfCeremonies: searchRegex },
        { firstAcolyte: searchRegex },
        { secondAcolyte: searchRegex },
        { crossBearer: searchRegex },
        { thurifer: searchRegex },
        { boatBearer: searchRegex },
        { firstAuxiliary: searchRegex },
        { secondAuxiliary: searchRegex },
        { mitreBearer: searchRegex },
        { crosierBearer: searchRegex }
      ]
    }).sort({ assignmentDate: -1 }).lean();

    return res.status(200).json({
      success: true,
      count: matchedLogs.length,
      data: matchedLogs
    });
  } catch (err) {
    return res.status(500).json({ 
      success: false, 
      message: 'Search query executing fault runtime block intercept: ' + err.message 
    });
  }
};

/**
 * @desc    Update live attendance tracking maps for transparency and return to users
 * @route   PUT /api/admin/mass-assignments/:id/attendance
 * @access  Private (Admin Role Enforced)
 */
exports.updateMassAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { attendance } = req.body; // e.g. {"Sacristan": "Served", "MC": "Served"}

    if (!attendance) {
      return res.status(400).json({
        success: false,
        message: 'Attendance data payload mapping is required to complete update.'
      });
    }

    // 1. Fetch the document first
    const assignment = await Assignment.findById(id);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Target liturgical assignment record could not be found.'
      });
    }

    // 2. Clear old attendance entries completely to avoid merge conflicts
    assignment.attendance = new Map();

    // 3. Loop through incoming object and save entries into Mongoose Map safely
    Object.keys(attendance).forEach((role) => {
      assignment.attendance.set(role, attendance[role]);
    });

    // 4. 🚀 CRITICAL STEP: Explicitly tell Mongoose that the map data has changed!
    assignment.markModified('attendance');

    // 5. Save the document back to the cluster database
    await assignment.save();

    return res.status(200).json({
      success: true,
      message: '🛡️ Attendance verified and successfully returned to User Panels!',
      data: assignment
    });

  } catch (err) {
    console.error('❌ Attendance Pipeline Execution Failure:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server breakdown modifying target validation checklist: ' + err.message
    });
  }
};