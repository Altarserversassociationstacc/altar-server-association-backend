/**
 * @file Assignment.js
 * @description Central data schema modeling plain-text liturgical rosters, 
 * conditional pontifical parameters, flexible attendance tracking configurations, 
 * and transactional schedule tracking constraints.
 */

const mongoose = require('mongoose');

const AssignmentSchema = new mongoose.Schema({
  massTitle: {
    type: String,
    required: [true, 'Celebration title is mandatory.'],
    trim: true
  },
  assignmentDate: {
    type: String, // Tracks layout precisely as YYYY-MM-DD
    required: [true, 'Calendar target date is required.'],
    trim: true
  },
  assignmentTime: {
    type: String, // Tracks layout precisely as HH:MM
    required: [true, 'Execution timestamp time is required.'],
    trim: true
  },
  serviceType: {
    type: String,
    required: [true, 'Classification service type schedule validation is required.'],
    enum: ['Sunday Mass', 'Bishop Mass', 'Weekday Mass'],
    default: 'Sunday Mass'
  },
  sacristan: {
    type: String,
    trim: true,
    default: ''
  },
  masterOfCeremonies: {
    type: String,
    trim: true,
    default: ''
  },
  firstAcolyte: {
    type: String,
    trim: true,
    default: ''
  },
  secondAcolyte: {
    type: String,
    trim: true,
    default: ''
  },
  hasSecondAcolyte: {
    type: Boolean,
    default: true
  },
  crossBearer: {
    type: String,
    trim: true,
    default: ''
  },
  thurifer: {
    type: String,
    trim: true,
    default: ''
  },
  boatBearer: {
    type: String,
    trim: true,
    default: ''
  },
  firstAuxiliary: {
    type: String,
    trim: true,
    default: ''
  },
  secondAuxiliary: {
    type: String,
    trim: true,
    default: ''
  },
  mitreBearer: {
    type: String,
    trim: true,
    default: ''
  },
  crosierBearer: {
    type: String,
    trim: true,
    default: ''
  },
  
  // 🛡️ INTEGRATED TRANSPARENCY ATTENDANCE MAP MATRIX LAYER
  attendance: {
    type: Map,
    of: String, // Maps strings directly (e.g., Key: "Sacristan" -> Value: "Served" / "Missed")
    default: {} // Prevents frontend crash errors on newly initiated assignments
  },

  deployedByAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: [true, 'Tracking identifier assignment signature trace is required.']
  }
}, {
  timestamps: true // Instantiates automatic createdAt and updatedAt fields natively
});

// 🔒 HARD ENGINE PROTECTION: Prevent duplicate schedule maps across matching times slots
AssignmentSchema.index({ assignmentDate: 1, assignmentTime: 1 }, { unique: true });

module.exports = mongoose.model('Assignment', AssignmentSchema);