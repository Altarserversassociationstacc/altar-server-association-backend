const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: String,
    enum: ['Meeting', 'Mass', 'Other'],
    required: true
  },
  description: {
    type: String, // e.g., "Sunday Mass 9:00AM", "General Meeting", "Clean up"
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Attendance', attendanceSchema);