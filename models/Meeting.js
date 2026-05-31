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
    // e.g., "General Assembly"
  },
  day: {
    type: String,
    required: [true, 'Calendar day (e.g. Saturday) is required for audit trails.'],
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  },
  dateString: {
    type: String,
    required: [true, 'Human-readable date string is required for frontend display.'],
    // e.g., "27th April 2026"
  },
  eventDate: {
    type: Date,
    required: [true, 'System Date object is required for chronological sorting.'],
    // Used for backend sorting logic (e.g., .sort({ eventDate: -1 }))
  },
  semester: {
    type: String,
    required: [true, 'Semester allocation is required for performance audits.'],
    enum: {
      values: ['First Semester', 'Second Semester'],
      message: '{VALUE} is not a valid academic semester.'
    }
  },
  academicYear: {
    type: String,
    default: '2025/2026', // Useful for historical archiving
  },
  // High-performance array of Student ObjectIDs
  attendanceList: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
    }
  ]
}, { 
  timestamps: true,
  // Ensure that when converting to JSON, virtuals and getters are included
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual: Calculate attendance count without needing to load the whole list
MeetingSchema.virtual('attendanceCount').get(function() {
  return this.attendanceList ? this.attendanceList.length : 0;
});

module.exports = mongoose.model('Meeting', MeetingSchema);