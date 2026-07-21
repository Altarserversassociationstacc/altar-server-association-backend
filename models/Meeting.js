const mongoose = require('mongoose');

/**
 * @schema Meeting
 * @description Advanced governance schema for tracking guild participation 
 * across FUTO academic semesters and specific liturgical dates.
 */
const MeetingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Meeting title is mandatory for registry indexing.'],
    trim: true,
  },
  // 🟢 ADDED: Activity Type Field
  type: {
    type: String,
    required: [true, 'Activity type is required.'],
    enum: {
      values: ['Meeting', 'Practice', 'Cloth Washing'],
      message: '{VALUE} is not a valid activity type.'
    },
    default: 'Meeting'
  },
  day: {
    type: String,
    required: [true, 'Calendar day (e.g. Saturday) is required for audit trails.'],
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  },
  dateString: {
    type: String,
    required: [true, 'Human-readable date string is required for frontend display.'],
  },
  eventDate: {
    type: Date,
    required: [true, 'System Date object is required for chronological sorting.'],
  },
  semester: {
    type: String,
    required: [true, 'Semester allocation is required for performance audits.'],
    enum: {
      values: ['Harmattan Semester', 'Rain Semester'],
      message: '{VALUE} is not a valid academic semester.'
    }
  },
  academicYear: {
    type: String,
    default: '2025/2026',
  },
  attendanceList: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
    }
  ]
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

MeetingSchema.virtual('attendanceCount').get(function() {
  return this.attendanceList ? this.attendanceList.length : 0;
});

module.exports = mongoose.model('Meeting', MeetingSchema);