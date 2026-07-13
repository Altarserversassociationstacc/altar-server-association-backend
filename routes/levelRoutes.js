/**
 * @file levelRoutes.js
 * @description API routes for managing academic level student rosters and group photos.
 */

const express = require('express');
const { 
  createStudent, 
  getStudents, 
  saveGroupPhoto, 
  getGroupPhoto 
} = require('../controllers/levelController');

// Optional: Import your auth/admin middleware if you have them in your project
// const { protect, authorizeAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

/* ==========================================================================
   STUDENT ROSTER ENDPOINTS
   Base Path: /api/levels/students
   ========================================================================== */
router.route('/students')
  /**
   * @route   GET /api/levels/students
   * @desc    Retrieve students (supports filtering by level and academicYear)
   * @access  Public
   */
  .get(getStudents)

  /**
   * @route   POST /api/levels/students
   * @desc    Add a new student profile to a specific level roster
   * @access  Private / Admin Only
   * @example .post(protect, authorizeAdmin, createStudent) // Un-comment when auth is ready
   */
  .post(createStudent);


/* ==========================================================================
   GROUP PHOTO ENDPOINTS
   Base Path: /api/levels/group-photo
   ========================================================================== */
router.route('/group-photo')
  /**
   * @route   GET /api/levels/group-photo
   * @desc    Retrieve the official group photo for a level and academic year
   * @access  Public
   */
  .get(getGroupPhoto)

  /**
   * @route   POST /api/levels/group-photo
   * @desc    Upload or update the official group photo for a level session
   * @access  Private / Admin Only
   * @example .post(protect, authorizeAdmin, saveGroupPhoto) // Un-comment when auth is ready
   */
  .post(saveGroupPhoto);

module.exports = router;