const mongoose = require('mongoose');

const ExecutiveSchema = new mongoose.Schema({
  sessionYear: {
    type: String,
    required: true,
  },
  executiveName: {
    type: String,
    required: function() { return !this.isGroupPhoto; },
  },
  name: {
    type: String,
    // Required only if it's an individual executive, not for a group photo
    required: function() { return !this.isGroupPhoto; },
  },
  position: {
    type: String,
    // Required only if it's an individual executive
    required: function() { return !this.isGroupPhoto; },
  },
  bio: {
    type: String,
  },
  // Department, email, and phoneNumber are required only for individual executives
  department: {
    type: String,
    required: function() { return !this.isGroupPhoto; },
  },
  email: {
    type: String,
    required: function() { return !this.isGroupPhoto; },
  },
  phoneNumber: {
    type: String,
    required: function() { return !this.isGroupPhoto; },
  },
  imageUrl: {
    type: String,
    required: true,
  },
  isGroupPhoto: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true }); // Adds createdAt and updatedAt

module.exports = mongoose.model('Executive', ExecutiveSchema);