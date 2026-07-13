const mongoose = require('mongoose');

const groupPhotoSchema = new mongoose.Schema({
  levelName: {
    type: String,
    required: [true, 'Level name is required'],
    enum: ['100-Level', '200-Level', '300-Level', '400-Level', '500-Level', 'Alumni']
  },
  academicYear: {
    type: String,
    required: [true, 'Academic year is required'], // e.g., "2026/2027"
    trim: true
  },
  imageUrl: {
    type: String,
    required: [true, 'Group photo URL is required']
  },
  caption: {
    type: String,
    default: 'Official Class Assembly'
  }
}, { timestamps: true });

// Ensure only ONE group photo exists per level per academic year
groupPhotoSchema.index({ levelName: 1, academicYear: 1 }, { unique: true });

module.exports = mongoose.model('GroupPhoto', groupPhotoSchema);