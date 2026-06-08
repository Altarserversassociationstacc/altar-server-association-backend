const express = require('express');
const router = express.Router();

const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');
const assignmentController = require('../controllers/assignmentController'); 
const announcementRoutes = require('./announcementRoutes');

// Safe Extraction
const protect = authMiddleware.protect || authMiddleware; 
const adminGate = authMiddleware.adminGate;

// Production Fallbacks to guarantee the live container stays online
const findStudent = adminController.findStudentByRegistryId || ((req, res) => res.status(500).json({ error: "Feature unavailable" }));
const getAllStudents = adminController.getAllStudents || ((req, res) => res.status(500).json({ error: "Feature unavailable" }));
const getDashboardStats = adminController.getDashboardStats || ((req, res) => res.status(500).json({ error: "Feature unavailable" }));
const getMeetingsList = adminController.getMeetingsList || ((req, res) => res.status(500).json({ error: "Feature unavailable" }));
const createMeeting = adminController.createMeeting || ((req, res) => res.status(500).json({ error: "Feature unavailable" }));
const toggleAttendance = adminController.toggleAttendance || ((req, res) => res.status(500).json({ error: "Feature unavailable" }));

// ==========================================
// ADMINISTRATIVE ENDPOINTS
// ==========================================
router.post('/signup', adminController.signup || ((req, res) => res.sendStatus(500)));
router.post('/login', adminController.login || ((req, res) => res.sendStatus(500)));

router.get('/find-student/:lookupKey', protect, findStudent);
router.get('/students', protect, getAllStudents);
router.get('/dashboard-stats', protect, getDashboardStats);

router.get('/approve/:token', adminController.approve || ((req, res) => res.sendStatus(500)));
router.get('/approve-student-direct/:id', adminController.approveStudent || ((req, res) => res.sendStatus(500)));
router.post('/finalize-approval-execution/:id', adminController.finalizeApprovalExecution || ((req, res) => res.sendStatus(500)));

router.put('/update-student-status/:studentId', protect, adminController.updateStudentStatus || ((req, res) => res.sendStatus(500)));
router.delete('/students/:id', protect, adminController.deleteStudent || ((req, res) => res.sendStatus(500)));

router.get('/meetings-list', protect, getMeetingsList);
router.post('/meetings', protect, createMeeting);
router.put('/meetings/:meetingId/toggle-attendance', protect, toggleAttendance); 

// Assignment Fallbacks
const getHistory = assignmentController.getAssignmentHistory || ((req, res) => res.sendStatus(500));
const searchAssignments = assignmentController.searchAssignmentsByStudentName || ((req, res) => res.sendStatus(500));
const createAssign = assignmentController.createAssignment || ((req, res) => res.sendStatus(500));
const updateMass = assignmentController.updateMassAttendance || ((req, res) => res.sendStatus(500));

router.get('/assignments/history', protect, getHistory);
router.get('/student/my-assignments/search', protect, searchAssignments);

if (adminGate) {
    router.post('/mass-assignments', protect, adminGate, createAssign);
    router.put('/mass-assignments/:id/attendance', protect, adminGate, updateMass);
}

router.use('/announcements', announcementRoutes);

module.exports = router;