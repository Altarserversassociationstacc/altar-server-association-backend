const express = require('express');
const { 
  createStudent, 
  getStudents, 
  saveGroupPhoto, 
  getGroupPhoto 
} = require('../controllers/levelController');

const router = express.Router();

// Student roster routes
router.route('/students')
  .post(createStudent)
  .get(getStudents);

// Group photo routes
router.route('/group-photo')
  .post(saveGroupPhoto)
  .get(getGroupPhoto);

module.exports = router;