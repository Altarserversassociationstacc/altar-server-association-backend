const mongoose = require('mongoose');

const FeeConfigSchema = new mongoose.Schema({
  academicYear: {
    type: String,
    required: true,
    trim: true,
  },
  targetLevel: {
    type: String,
    required: true,
    trim: true,
  },
  narration: {
    type: String,
    required: true,
    trim: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  }
}, { timestamps: true });

// Prevent duplicate fee entries for the same level, year, and narration
FeeConfigSchema.index({ academicYear: 1, targetLevel: 1, narration: 1 }, { unique: true });

module.exports = mongoose.model('FeeConfig', FeeConfigSchema);