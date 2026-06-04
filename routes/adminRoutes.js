// const express = require('express');
// const router = express.Router();

// const adminController = require('../controllers/adminController');
// const assignmentController = require('../controllers/assignmentController'); 
// const announcementRoutes = require('./announcementRoutes');
// const { protect, adminGate } = require('../middleware/authMiddleware'); 

// // Administrative Sessions
// router.post('/signup', adminController.signup);
// router.post('/login', adminController.login);

// // Registry Workbooks & Action Operations
// router.get('/find-student/:lookupKey', protect, adminController.findStudentByRegistryId);
// router.get('/students', protect, adminController.getAllStudents);
// router.get('/dashboard-stats', protect, adminController.getDashboardStats);


// // 1. Handles historical/old email links (This fixes your current error)
// router.get('/approve/:token', adminController.approve);

// // 2. Handles the new direct-ID links
// router.get('/approve-student-direct/:id', adminController.approveStudent);
// router.put('/update-student-status/:studentId', protect, adminController.updateStudentStatus);
// router.delete('/students/:id', protect, adminController.deleteStudent);

// // Assembly Lifecycles
// router.get('/meetings-list', protect, adminController.getMeetingsList);
// router.post('/meetings', protect, adminController.createMeeting);
// router.put('/meetings/:meetingId/toggle-attendance', protect, adminController.toggleAttendance); 

// // Liturgical Matrix Assignments
// router.get('/assignments/history', protect, assignmentController.getAssignmentHistory);
// router.get('/student/my-assignments/search', protect, assignmentController.searchAssignmentsByStudentName);
// router.post('/mass-assignments', protect, adminGate, assignmentController.createAssignment);
// router.put('/mass-assignments/:id/attendance', protect, adminGate, assignmentController.updateMassAttendance);

// router.use('/announcements', announcementRoutes);

// module.exports = router;
const express = require('express');
const router = express.Router();

// System Controllers
const adminController = require('../controllers/adminController');
const assignmentController = require('../controllers/assignmentController'); 
const announcementRoutes = require('./announcementRoutes');
const User = require('../models/Student'); // Embedded resource layer fallback

// Security Authorization Gates
const { protect, adminGate } = require('../middleware/authMiddleware'); 

// ==========================================
// ADMINISTRATIVE MANAGEMENT ENDPOINTS
// ==========================================

router.post('/signup', adminController.signup);
router.post('/login', adminController.login);

// Registry Workbooks & Action Operations
router.get('/find-student/:lookupKey', protect, adminController.findStudentByRegistryId);
router.get('/students', protect, adminController.getAllStudents);
router.get('/dashboard-stats', protect, adminController.getDashboardStats);

// ==========================================
// CRITICAL SIGNUP SECURITY VERIFICATION WORKFLOWS
// ==========================================

// 1. Intercepts historical approval parameters gracefully
router.get('/approve/:token', adminController.approve);

// 2. Renders the secure profile credential dashboard sheet to the Admin
router.get('/approve-student-direct/:id', adminController.approveStudent);

// 3. EXECUTION ACTION: Confirms profile metrics and processes database activation state
router.post('/finalize-approval-execution/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const student = await User.findById(id);

    if (!student) {
      return res.status(404).send('Verification failed: This student profile data could not be located inside the system.');
    }

    // Commit changes to database permanently
    student.isVerified = true;
    await student.save();

    // Smooth hand-off redirect routing back to your frontend framework
    const targetRedirect = process.env.CLIENT_URL || 'http://localhost:5173';
    return res.redirect(`${targetRedirect}/verify-email?email=${encodeURIComponent(student.email)}&approved=true`);
  } catch (err) {
    return res.status(500).send('Database writing verification parameters failed: ' + err.message);
  }
});

router.put('/update-student-status/:studentId', protect, adminController.updateStudentStatus);
router.delete('/students/:id', protect, adminController.deleteStudent);

// ==========================================
// ASSEMBLY LIFECYCLES & LITURGICAL DATA
// ==========================================
router.get('/meetings-list', protect, adminController.getMeetingsList);
router.post('/meetings', protect, adminController.createMeeting);
router.put('/meetings/:meetingId/toggle-attendance', protect, adminController.toggleAttendance); 

router.get('/assignments/history', protect, assignmentController.getAssignmentHistory);
router.get('/student/my-assignments/search', protect, assignmentController.searchAssignmentsByStudentName);
router.post('/mass-assignments', protect, adminGate, assignmentController.createAssignment);
router.put('/mass-assignments/:id/attendance', protect, adminGate, assignmentController.updateMassAttendance);

router.use('/announcements', announcementRoutes);

module.exports = router;