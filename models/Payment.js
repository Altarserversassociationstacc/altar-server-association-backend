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
    required: true // Stored base amount (e.g., 100)
  },
  paystackFee: {
    type: Number,
    default: 0 // Optional: Stores the fee (e.g., 1.53)
  },
  totalPaid: {
    type: Number // Optional: Stores gross paid (e.g., 101.53)
  },
  status: {
    type: String,
    enum: ['success', 'failed', 'pending'],
    default: 'pending' // Recommended: start as 'pending' until verified
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
    enum: ['100L', '200L', '300L', '400L', '500L', '600L'], // Matched with FeeConfig
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
    type: Date
  }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('Payment', paymentSchema);