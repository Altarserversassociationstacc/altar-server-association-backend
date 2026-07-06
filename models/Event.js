const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { 
    type: String, 
    enum: ["All Events", "General", "General Meetings", "General Practice", "ASA Novena", "ASA Chaplaincy Cup", "Sendforth Events"],
    required: true 
  },
  description: { type: String, required: true },
  narration: { type: String, required: true },
  eventDate: { type: Date, required: true },
  time: { type: String, required: true },
  location: { type: String, required: true },
  image: { type: String, required: true }, // Stores the filename or Cloudinary URL
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Event', eventSchema);