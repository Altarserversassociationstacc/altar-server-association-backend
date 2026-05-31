const mongoose = require('mongoose');

const GallerySchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    category: { 
      type: String, 
      enum: ["Liturgical", "Training", "Feast", "Service", "Brotherhood", "Ceremony"],
      required: false 
    },
    imageUrl: { type: String, required: true },
    publicId: { type: String }, // Useful if you are using Cloudinary
  },
  { timestamps: true }
);

module.exports = mongoose.model("Gallery", GallerySchema);