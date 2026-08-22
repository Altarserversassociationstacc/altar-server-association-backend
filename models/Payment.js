const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: [true, 'Student ID is required']
  },
  studentName: {
    type: String,
    required: true,
    trim: true,
    default: 'Portal User'
  },
  reference: {
    type: String,
    required: true,
    unique: true, 
    index: true,
    trim: true
  },
  amount: {
    type: Number, 
    required: true 
  },
  status: {
    type: String,
    enum: ['success', 'failed', 'pending'],
    default: 'success'
  },
  narration: {
    type: String,
    required: true,
    trim: true,
    default: 'Sessional Dues'
  },
  targetLevel: {
    type: String,
    required: true,
    trim: true,
    default: '100L'
  },
  academicYear: {
    type: String,
    required: true,
    trim: true,
    default: 'N/A'
  },
  session: {
    type: String,
    required: true,
    trim: true,
    default: 'N/A'
  },
  paidAt: {
    type: Date,
    default: Date.now
  }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('Payment', paymentSchema);