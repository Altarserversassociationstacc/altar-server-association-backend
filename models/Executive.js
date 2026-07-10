const mongoose = require('mongoose');

/**
 * Executive Schema
 * Represents either a specific student official or a session-wide group portrait.
 */
const ExecutiveSchema = new mongoose.Schema({
  sessionYear: {
    type: String,
    required: [true, 'Session year is required'],
    trim: true,
    index: true // Optimized for filtering by year
  },
  executiveName: {
    type: String,
    required: [true, 'Executive/Council name is required'],
    trim: true
  },
  name: {
    type: String,
    required: function() { return !this.isGroupPhoto; },
    trim: true
  },
  position: {
    type: String,
    required: function() { return !this.isGroupPhoto; },
    trim: true
  },
  bio: {
    type: String,
    trim: true
  },
  department: {
    type: String,
    required: function() { return !this.isGroupPhoto; },
    trim: true
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(v) {
        if (!this.isGroupPhoto && v) return /^\S+@\S+\.\S+$/.test(v);
        return true;
      },
      message: 'Please provide a valid email address'
    },
    required: function() { return !this.isGroupPhoto; }
  },
  phoneNumber: {
    type: String,
    required: function() { return !this.isGroupPhoto; },
    trim: true
  },
  imageUrl: {
    type: String,
    required: [true, 'Image URL is required']
  },
  isGroupPhoto: {
    type: Boolean,
    default: false,
    index: true // Optimized for separating group vs individual views
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Helper index for common lookup patterns
ExecutiveSchema.index({ sessionYear: 1, isGroupPhoto: 1 });

module.exports = mongoose.model('Executive', ExecutiveSchema);