const mongoose = require('mongoose');

const levelStudentSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true
  },
  imageUrl: {
    type: String,
    required: [true, 'Student image URL is required']
  },
  skills: {
    type: [String], // Array of strings (e.g., ["React", "Liturgical Leadership"])
    default: []
  },
  state: {
    type: String,
    required: [true, 'State of origin/residence is required'],
    trim: true
  },
  homeOfResidence: {
    type: String,
    required: [true, 'Home residence address is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true
  },
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  level: {
    type: String,
    required: [true, 'Level is required'], // e.g., "100-Level"
    enum: ['100-Level', '200-Level', '300-Level', '400-Level', '500-Level', 'Alumni']
  },
  academicYear: {
    type: String,
    required: [true, 'Academic year is required'], // e.g., "2026/2027"
    trim: true
  }
}, { timestamps: true });
module.exports = mongoose.model('LevelStudent', levelStudentSchema);