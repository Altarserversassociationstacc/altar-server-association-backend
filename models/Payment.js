const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  studentName: {
    type: String,
    required: true
  },
  reference: {
    type: String,
    required: true,
    unique: true, 
    index: true   
  },
  amount: {
    type: Number, 
    required: true 
  },
  status: {
    type: String,
    enum: [ 'success', 'failed'],
    default: 'success'
  },
  narration: {
    type: String,
    required: true,
    enum: [
      'Sessional Dues', 
      'Sendforth levy and Appeal fund card', 
      'Donation', 
      'Other Clearance'
    ],
    default: 'Sessional Dues'
  },
  targetLevel: {
    type: String,
    required: true 
  },
  academicYear: {
    type: String,
    required: true 
  },
  session: {
    type: String,
    required: true 
  },
  paidAt: {
    type: Date
  }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('Payment', paymentSchema);