const Notification = require('../models/Notification');

// @desc    Get user notifications (last 10)
exports.getNotifications = async (req, res) => {
  try {
    // This finds notifications sent to the user OR general ones (null)
    const notifications = await Notification.find({ 
      $or: [
        { recipient: req.params.userId },
        { recipient: null } // This allows general "broadcasts" to show up
      ]
    })
    .sort({ createdAt: -1 })
    .limit(10);
    
    res.status(200).json(notifications);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
// @desc    Mark all notifications as read for a user
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.params.userId, isRead: false },
      { $set: { isRead: true } }
    );
    res.status(200).json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
};

// @desc    Create a new notification (For Admin use)
exports.createNotification = async (req, res) => {
  try {
    const { recipient, title, message } = req.body;
    const notification = await Notification.create({ recipient, title, message });
    
    res.status(201).json(notification);
  } catch (err) {
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
};