import express from 'express';
import { 
  createStudent, 
  getStudents, 
  saveGroupPhoto, 
  getGroupPhoto 
} from '../controllers/levelController.js';

const router = express.Router();

// Student roster routes
router.route('/students')
  .post(createStudent)
  .get(getStudents);

// Group photo routes
router.route('/group-photo')
  .post(saveGroupPhoto)
  .get(getGroupPhoto);

export default router;