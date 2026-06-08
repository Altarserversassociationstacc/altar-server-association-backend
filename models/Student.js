const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Please add a full name'],
  },
  gender: {
    type: String,
    required: [true, 'Please select a gender'],
    enum: ['Male', 'Female', 'Other'],
  },
  dateOfBirth: { type: Date, required: false },
  phoneNumber: { type: String, required: false },
  regNo: { type: String, required: false, unique: true, sparse: true },
  schoolResidentialAddress: { type: String, required: false },
  department: { type: String, required: false },
  currentLevel: { 
    type: String, 
    required: true, 
    enum: ['100L', '200L', '300L', '400L', '500L'], 
    default: '100L'
  },
  levelInducted: { 
    type: String, 
    required: true, 
    enum: ['100L', '200L', '300L', '400L', '500L'],
    default: '100L'
  },
  stateOfOrigin: { type: String, required: false },
  homeTown: { type: String, required: false },
  permanentResidence: { type: String, required: false },
  homeDiocese: { type: String, required: false },
  profilePicture: { type: String, default: '' },
  communityAccessRequest: {
    type: String,
    enum: ['none', 'pending', 'approved', 'rejected'],
    default: 'none',
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please add a valid email'],
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false,
  },
  isVerified: { type: Boolean, default: false },
  isEmailVerified: { type: Boolean, default: false },
  isProfileComplete: { type: Boolean, default: false },
  accountStatus: {
    type: String,
    enum: ['Active', 'Locked', 'Dormant', 'Suspended'],
    default: 'Active'
  },
  statusReason: { type: String, default: '' },
  
  // 🚀 PROFESSIONAL STATS AGGREGATION PATTERN
  performanceHistory: [{
    semester: { 
      type: String, 
      required: true 
    },
    levelAtTime: { 
      type: String, 
      enum: ['100L', '200L', '300L', '400L', '500L'],
      required: true 
    },
    massesAssigned: { 
      type: Number, 
      default: 0 
    },
    massesServed: { 
      type: Number, 
      default: 0 
    }
  }],

  verificationCode: String,
  verificationToken: String,
  codeExpires: Date,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Student', StudentSchema);