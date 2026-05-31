const Event = require('../models/Event');
const cloudinary = require('cloudinary').v2;

// @desc    Fetch all events
// @route   GET /api/events
exports.getEvents = async (req, res) => {
  try {
    const events = await Event.find().sort({ eventDate: -1 });
    res.status(200).json(events);
  } catch (err) {
    res.status(500).json({ message: "Error fetching events: " + err.message });
  }
};

// @desc    Publish a new event flyer
// @route   POST /api/events
exports.createEvent = async (req, res) => {
  try {
    console.log('Publishing Event - Body:', req.body);
    console.log('Publishing Event - File:', req.file);
    const { title, category, description, narration, eventDate, time, location } = req.body;
    if (!req.file) return res.status(400).json({ message: 'Event flyer image is required.' });

    const newEvent = new Event({
      title,
      category,
      description,
      narration,
      eventDate,
      time,
      location,
      image: req.file.path || req.file.filename, // Supports local or Cloudinary paths
    });

    await newEvent.save();
    res.status(201).json(newEvent);
  } catch (err) {
    res.status(400).json({ message: "Failed to publish event: " + err.message });
  }
};

// @desc    Update an existing event
// @route   PUT /api/events/:id
exports.updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    console.log('Updating Event - ID:', id);
    console.log('Updating Event - File:', req.file);

    const event = await Event.findById(id);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    // Logic to handle flyer update
    if (req.file) {
      // Delete old image from Cloudinary if it exists
      if (event.image) {
        const publicId = event.image.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(`events/${publicId}`).catch(err => 
          console.error("Cloudinary Cleanup Warning:", err.message)
        );
      }
      updateData.image = req.file.path || req.file.filename;
    } else {
      delete updateData.image;
    }

    const updatedEvent = await Event.findByIdAndUpdate(id, updateData, { 
      new: true,
      runValidators: true 
    });
    
    res.json(updatedEvent);
  } catch (err) {
    res.status(400).json({ message: "Update failed: " + err.message });
  }
};

// @desc    Delete an event
// @route   DELETE /api/events/:id
exports.deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    // Delete image from Cloudinary
    if (event.image) {
      try {
        const publicId = event.image.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(`asa_futo_events/${publicId}`);
      } catch (cloudinaryErr) {
        console.error("Cloudinary Cleanup Warning:", cloudinaryErr.message);
      }
    }

    await Event.findByIdAndDelete(req.params.id);
    res.json({ message: 'Event flyer deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: "Deletion failed: " + err.message });
  }
};