/**
 * @file levelRoutes.js
 * @description Router for academic level rosters and official group photos.
 * @mount /api/levels
 */

const express = require('express');
const { 
  createStudent, 
  getStudents, 
  getStudentById,
  updateStudent,
  deleteStudent,
  saveGroupPhoto, 
  getGroupPhoto,
  updateGroupPhoto,
  deleteGroupPhoto 
} = require('../controllers/levelController');

// Optional: Import authentication guards when ready for production
// const { protect, authorizeAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// ==========================================
// STUDENT ROSTER ENDPOINTS
// ==========================================

router.route('/students')
  .get(getStudents)
  .post(createStudent); // e.g., .post(protect, authorizeAdmin, createStudent)

router.route('/students/:id')
  .get(getStudentById)
  .put(updateStudent)
  .delete(deleteStudent);


// ==========================================
// GROUP PHOTO ENDPOINTS
// ==========================================

router.route('/group-photo')
  .get(getGroupPhoto)
  .post(saveGroupPhoto);

router.route('/group-photo/:id')
  .put(updateGroupPhoto)
  .delete(deleteGroupPhoto);


module.exports = router;