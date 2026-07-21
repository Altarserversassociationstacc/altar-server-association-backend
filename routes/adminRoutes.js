const express = require('express');
const router = express.Router();

const adminController = require('../controllers/adminController');
const meetingController = require('../controllers/meetingController'); // 🚀 Explicit import prevents 404s
const assignmentController = require('../controllers/assignmentController'); 
const announcementRoutes = require('./announcementRoutes');
const authMiddleware = require('../middleware/authMiddleware');

const protect = authMiddleware.protect || authMiddleware; 
const adminGate = authMiddleware.adminGate || ((req, res, next) => next());

/**
 * Higher-Order Function to guarantee container uptime.
 * Returns 503 Service Unavailable if a handler is uninitialized instead of dropping routes.
 */
const createSafeHandler = (handler, endpointName) => {
  if (typeof handler === 'function') return handler;
  console.warn(`[Router Warning] Handler missing for endpoint: ${endpointName}. Defaulting to safe fallback.`);
  return (req, res) => res.status(503).json({ 
    success: false, 
    error: "Service Temporarily Unavailable",
    details: `The requested handler (${endpointName}) is not currently initialized.`
  });
};

// ==========================================
// AUTHENTICATION & CORE ADMIN ENDPOINTS
// ==========================================
router.post('/signup', createSafeHandler(adminController.signup, 'signup'));
router.post('/login', createSafeHandler(adminController.login, 'login'));

router.get('/dashboard-stats', protect, createSafeHandler(adminController.getDashboardStats, 'getDashboardStats'));
router.get('/students', protect, createSafeHandler(adminController.getAllStudents, 'getAllStudents'));
router.get('/find-student/:lookupKey', protect, createSafeHandler(adminController.findStudentByRegistryId, 'findStudentByRegistryId'));

// ==========================================
// APPROVAL & STUDENT STATUS WORKFLOWS
// ==========================================
router.get('/approve/:token', createSafeHandler(adminController.approve, 'approve'));
router.get('/approve-student-direct/:id', createSafeHandler(adminController.approveStudent, 'approveStudent'));
router.post('/finalize-approval-execution/:id', createSafeHandler(adminController.finalizeApprovalExecution, 'finalizeApprovalExecution'));

router.route('/students/:id')
  .delete(protect, createSafeHandler(adminController.deleteStudent, 'deleteStudent'));

router.put('/update-student-status/:studentId', protect, createSafeHandler(adminController.updateStudentStatus, 'updateStudentStatus'));

// ==========================================
// MEETING & ATTENDANCE MANAGEMENT
// ==========================================
// 1. Root collection endpoints & legacy list support
router.get('/meetings-list', protect, createSafeHandler(meetingController.getMeetingsList, 'getMeetingsList'));
router.route('/meetings')
  .get(protect, createSafeHandler(meetingController.getMeetingsList, 'getMeetingsList'))
  .post(protect, createSafeHandler(meetingController.createMeeting, 'createMeeting'));

// 2. Specific action endpoints must precede generic resource IDs
router.put(
  '/meetings/:meetingId/toggle-attendance', 
  protect, 
  createSafeHandler(meetingController.toggleAttendance, 'toggleAttendance')
); 

// 3. 🚀 Standard RESTful Resource Routes for Edit & Delete (Resolves the 404s)
router.route('/meetings/:id')
  .put(protect, createSafeHandler(meetingController.updateMeeting, 'updateMeeting'))
  .delete(protect, createSafeHandler(meetingController.deleteMeeting, 'deleteMeeting'));

// ==========================================
// ASSIGNMENT & MASS TRACKING
// ==========================================
router.get('/assignments/history', protect, createSafeHandler(assignmentController.getAssignmentHistory, 'getAssignmentHistory'));
router.get('/student/my-assignments/search', protect, createSafeHandler(assignmentController.searchAssignmentsByStudentName, 'searchAssignmentsByStudentName'));

router.route('/mass-assignments')
  .post(protect, adminGate, createSafeHandler(assignmentController.createAssignment, 'createAssignment'));

router.put(
  '/mass-assignments/:id/attendance', 
  protect, 
  adminGate, 
  createSafeHandler(assignmentController.updateMassAttendance, 'updateMassAttendance')
);

// ==========================================
// SUB-ROUTERS
// ==========================================
router.use('/announcements', announcementRoutes);

module.exports = router;