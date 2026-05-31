const router = require('express').Router();
const Gallery = require('../models/Gallery');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure storage for uploaded gallery images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/gallery/';
    // Automatically create directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// @desc    Upload new image to gallery
// @route   POST /api/gallery
router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Please select an image to upload." });
    }

    const newImage = new Gallery({
      title: req.body.title,
      imageUrl: req.file.path.replace(/\\/g, '/') // Ensure path uses forward slashes
    });

    const savedImage = await newImage.save();
    res.status(201).json(savedImage);
  } catch (err) {
    res.status(500).json({ message: "Error uploading image", error: err });
  }
});

// @desc    Get all gallery images
// @route   GET /api/gallery
router.get('/', async (req, res) => {
  try {
    const images = await Gallery.find().sort({ createdAt: -1 });
    res.status(200).json(images);
  } catch (err) {
    res.status(500).json({ message: "Error fetching gallery", error: err.message });
  }
});

// @desc    Delete image from gallery
// @route   DELETE /api/gallery/:id
router.delete('/:id', async (req, res) => {
  try {
    const image = await Gallery.findById(req.params.id);
    if (!image) return res.status(404).json({ message: "Image not found" });
    
    // Physically delete the file from the server
    if (image.imageUrl) {
      fs.unlink(image.imageUrl, (err) => {
        if (err) console.error("Failed to delete local file:", err);
      });
    }

    await Gallery.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Image deleted from archives successfully." });
  } catch (err) {
    res.status(500).json({ message: "Error deleting image", error: err.message });
  }
});

module.exports = router;