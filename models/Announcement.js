const mongoose = require('mongoose');

const AnnouncementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      default: "General",
    },
    displayDate: {
      type: Date,
      required: false, // Make it optional, so old announcements don't break
    },
    displayTime: {
      type: String, // e.g., "10:30 AM" or "14:00"
      required: false, // Make it optional
    },
    venue: {
      type: String,
      required: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Announcement", AnnouncementSchema);