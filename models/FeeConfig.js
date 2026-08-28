const mongoose = require('mongoose');

const FeeConfigSchema = new mongoose.Schema({
  academicYear: {
    type: String,
    required: true,
    trim: true,
    match: [/^\d{4}\/\d{4}$/, 'Please use a valid academic year format like YYYY/YYYY'],
  },
  targetLevel: {
    type: String,
    required: true,
    trim: true,
    // Added 'L' to match Payment schema consistency
    enum: ['100L', '200L', '300L', '400L', '500L', '600L'], 
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

FeeConfigSchema.index({ academicYear: 1, targetLevel: 1, narration: 1 }, { unique: true });

module.exports = mongoose.model('FeeConfig', FeeConfigSchema);