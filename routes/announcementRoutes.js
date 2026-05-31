const router = require('express').Router();
const { 
  createAnnouncement, 
  getAnnouncements, 
  deleteAnnouncement 
} = require('../controllers/announcementController'); 
// Ensure the path above points directly to your professional controller file!

// CREATE ANNOUNCEMENT
// This handles the payload defensively, checks 'sendAsEmail', and runs asynchronous tasks
router.post('/', createAnnouncement);

// GET ALL ANNOUNCEMENTS
// This uses node-cache and .lean() for faster database feed load speeds
router.get('/', getAnnouncements);

// DELETE ANNOUNCEMENT
// This deletes the target record and instantly flushes invalid timeline caches
router.delete('/:id', deleteAnnouncement);

module.exports = router;