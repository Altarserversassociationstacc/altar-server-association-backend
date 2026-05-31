/**
 * @file Admin.js
 * @description Database data schema configuration for administrative user accounts.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const AdminSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email address is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/.+@.+\..+/, 'Please enter a valid email address'],
  },
  password: {
    type: String,
    required: [true, 'Password verification string is required'],
    minLength: [6, 'Password must be at least 6 characters long'],
    select: false, // Hides the field value by default during generic queries
  },
  role: {
    type: String,
    default: 'admin', 
  }
}, { 
  timestamps: true 
});

/**
 * Pre-save middleware hook to hash text passwords automatically.
 * Fully optimized for modern Mongoose async/await execution pipelines.
 */
AdminSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

/**
 * Instance helper method to check incoming plaintext credentials safely.
 */
AdminSchema.methods.matchPassword = async function (enteredPassword) {
  try {
    return await bcrypt.compare(enteredPassword, this.password);
  } catch (err) {
    return false;
  }
};

module.exports = mongoose.model('Admin', AdminSchema);