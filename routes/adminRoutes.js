/**
 * @file adminRoutes.js
 * @description Central routing engine for administrative authentication, workbook queries, 
 * assembly instances, liturgical assignments, and lifecycle account status modifications.
 */

const express = require('express');
const router = express.Router();

// Central Controller Module Injections
const adminController = require('../controllers/adminController');
const assignmentController = require('../controllers/assignmentController'); 
const announcementRoutes = require('./announcementRoutes');

// Clean Destructured Security Middleware Import
const { protect, adminGate } = require('../middleware/authMiddleware'); 

// ==========================================
// 1. ADMINISTRATIVE AUTHENTICATION ENDPOINTS
// ==========================================
router.post('/signup', adminController.signup);
router.post('/login', adminController.login);

// ==========================================
// 2. DATA REGISTRY ROSTER WORKBOOKS (SECURED)
// ==========================================
router.get('/find-student/:lookupKey', protect, adminController.findStudentByRegistryId);
router.get('/students', protect, adminController.getAllStudents);
router.get('/dashboard-stats', protect, adminController.getDashboardStats);
router.put('/approve-student/:id', protect, adminController.approveStudent);
router.put('/update-student-status/:studentId', protect, adminController.updateStudentStatus);
router.delete('/students/:id', protect, adminController.deleteStudent);

// ==========================================
// 3. ASSEMBLY LIFECYCLE & TRANSACTIONS
// ==========================================
router.get('/meetings-list', protect, adminController.getMeetingsList);
router.post('/meetings', protect, adminController.createMeeting);
router.put('/meetings/:meetingId/toggle-attendance', protect, adminController.toggleAttendance); 

// ==========================================
// 🏛️ 4. UNIVERSAL LITURGICAL DEPLOYMENT MATRIX
// ==========================================

// ✅ ALLOW ALL LOGGED-IN USERS TO VIEW HISTORY (Removed adminGate)
router.get('/assignments/history', protect, assignmentController.getAssignmentHistory);

// ✅ ALLOW STUDENTS TO SEARCH THEIR OWN ASSIGNMENTS
router.get('/student/my-assignments/search', protect, assignmentController.searchAssignmentsByStudentName);

// 🔒 ONLY ADMINS CAN CREATE NEW ASSIGNMENTS
router.post('/mass-assignments', protect, adminGate, assignmentController.createAssignment);

// 📡 LIVE ATTENDANCE BROADCAST LINK ENGINE
// ✅ Enforces security clearance before hitting the assignmentController pipeline handler
router.put('/mass-assignments/:id/attendance', protect, adminGate, assignmentController.updateMassAttendance);

// ==========================================
// 5. EXTERNAL MODULE SUB-ROUTER PLUGINS
// ==========================================
router.use('/announcements', announcementRoutes);

module.exports = router;