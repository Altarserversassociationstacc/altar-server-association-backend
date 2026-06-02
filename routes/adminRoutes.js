const express = require('express');
const router = express.Router();

const adminController = require('../controllers/adminController');
const assignmentController = require('../controllers/assignmentController'); 
const announcementRoutes = require('./announcementRoutes');
const { protect, adminGate } = require('../middleware/authMiddleware'); 

// Administrative Sessions
router.post('/signup', adminController.signup);
router.post('/login', adminController.login);

// Registry Workbooks & Action Operations
router.get('/find-student/:lookupKey', protect, adminController.findStudentByRegistryId);
router.get('/students', protect, adminController.getAllStudents);
router.get('/dashboard-stats', protect, adminController.getDashboardStats);

// ✅ BOTH ROUTING LIFECYCLES ARE NOW ACTIVE AT THE SAME TIME
router.get('/approve/:token', adminController.approve); // Intercepts historical email links cleanly
router.get('/approve-student-direct/:id', adminController.approveStudent); // Intercepts direct ID email links

router.put('/update-student-status/:studentId', protect, adminController.updateStudentStatus);
router.delete('/students/:id', protect, adminController.deleteStudent);

// Assembly Lifecycles
router.get('/meetings-list', protect, adminController.getMeetingsList);
router.post('/meetings', protect, adminController.createMeeting);
router.put('/meetings/:meetingId/toggle-attendance', protect, adminController.toggleAttendance); 

// Liturgical Matrix Assignments
router.get('/assignments/history', protect, assignmentController.getAssignmentHistory);
router.get('/student/my-assignments/search', protect, assignmentController.searchAssignmentsByStudentName);
router.post('/mass-assignments', protect, adminGate, assignmentController.createAssignment);
router.put('/mass-assignments/:id/attendance', protect, adminGate, assignmentController.updateMassAttendance);

router.use('/announcements', announcementRoutes);

module.exports = router;