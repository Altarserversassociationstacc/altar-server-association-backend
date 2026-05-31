const mongoose = require('mongoose');
const Announcement = require('../models/Announcement');
const User = require('../models/Student'); // Aligned to point to your Student model
const { sendOAuth2Email } = require('../services/emailService');
const NodeCache = require('node-cache');

const announcementCache = new NodeCache({ stdTTL: 300 }); // Cache lists for 5 minutes

/**
 * @desc    Create a new announcement & strictly broadcast to verified + approved members
 * @route   POST /api/announcements
 * @access  Private (Admin Only)
 */
exports.createAnnouncement = async (req, res) => {
  try {
    const { title, category, content, displayDate, displayTime, venue, sendAsEmail } = req.body;

    // 1. Fail early: Validate required fields
    if (!title || !content) {
      return res.status(400).json({ 
        success: false, 
        message: "Validation Failed: Title and Content fields are strictly required." 
      });
    }

    // 2. Commit the announcement to the database
    const newAnnouncement = await Announcement.create({
      title,
      category: category || "General",
      content,
      displayDate,
      displayTime,
      venue
    });

    // 3. Performance Optimization: Invalidate the feed cache so changes show up instantly
    announcementCache.del("announcements_feed");

    // 4. Return response to Frontend/Postman immediately so it doesn't hang
    res.status(201).json({
      success: true,
      message: "Announcement successfully published to dashboard.",
      data: newAnnouncement
    });

    // 5. Strict Background Email Worker
    if (sendAsEmail === true || sendAsEmail === 'true') {
      setImmediate(async () => {
        try {
          // STRICT WORKFLOW GATE: Admin Approved (isVerified) AND Student Confirmed (isEmailVerified)
          const approvedStudents = await User.find({
            email: { $exists: true, $ne: null },
            isEmailVerified: true, // Gate 1: Confirmed email ownership
            isVerified: true       // Gate 2: Vetted and approved by Admin
          }, 'email');

          // Strip whitespaces and parse array down to raw string elements
          const emailList = approvedStudents.map(u => u.email.trim()).filter(Boolean);

          // Guard: If no students meet both strict gates, abort email processing cleanly
          if (emailList.length === 0) {
            console.warn("[Background Broadcast] Operational Halt: 0 students match the (Email Verified + Admin Approved) strict criteria.");
            return;
          }

          const subject = `Sanctuary Broadcast: ${title}`;
          const htmlBody = `
            <div style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #2a1b12; border-radius: 16px; overflow: hidden; background-color: #111111; color: #d2b48c; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
              <div style="background-color: #1a1a1a; padding: 25px; text-align: center; border-bottom: 2px solid #8b4513;">
                <h1 style="color: #8b4513; margin: 0; font-size: 22px; text-transform: uppercase; letter-spacing: 2px; font-family: Georgia, serif;">The Clarion Call</h1>
                <p style="color: #888888; font-size: 10px; margin: 5px 0 0 0; text-transform: uppercase; letter-spacing: 1px;">Official Guild Communication</p>
              </div>
              <div style="padding: 35px 25px; background-color: #111111;">
                <h2 style="color: #ffffff; font-size: 18px; margin-top: 0; margin-bottom: 15px; font-family: Georgia, serif;">${title}</h2>
                <p style="color: #e0e0e0; line-height: 1.6; font-size: 14px; white-space: pre-wrap;">${content}</p>
                
                <div style="margin-top: 30px; padding: 20px; background-color: #1a120c; border-radius: 8px; border-left: 4px solid #8b4513;">
                  <table style="width: 100%; font-size: 13px; color: #d2b48c; border-collapse: collapse;">
                    ${venue ? `<tr><td style="padding: 4px 0; width: 80px;"><strong>Venue:</strong></td><td style="color: #ffffff;">${venue}</td></tr>` : ''}
                    ${displayDate ? `<tr><td style="padding: 4px 0;"><strong>Date:</strong></td><td style="color: #ffffff;">${new Date(displayDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td></tr>` : ''}
                    ${displayTime ? `<tr><td style="padding: 4px 0;"><strong>Time:</strong></td><td style="color: #ffffff;">${displayTime}</td></tr>` : ''}
                    <tr><td style="padding: 4px 0;"><strong>Type:</strong></td><td style="color: #ffffff; text-transform: capitalize;">${category}</td></tr>
                  </table>
                </div>
              </div>
              <div style="background-color: #0a0a0a; padding: 15px; text-align: center; font-size: 11px; color: #555555; border-top: 1px solid #1a1a1a;">
                <p style="margin: 0;">This is an automated operational broadcast from the Altar Server Association Portal.</p>
                <p style="margin: 5px 0 0 0;">&copy; 2026 Altar Server Association. All rights reserved.</p>
              </div>
            </div>
          `;

          await sendOAuth2Email(emailList, subject, htmlBody);
          console.log(`[Background Broadcast] Success: Dispatched emails to ${emailList.length} approved members.`);
        } catch (bgError) {
          console.error("🚨 [Background Broadcast Engine Crash]:", bgError.message);
        }
      });
    }

  } catch (error) {
    console.error("❌ [Create Announcement Critical Failure]:", error);
    return res.status(500).json({
      success: false,
      message: "An internal server error occurred while publishing the announcement."
    });
  }
};

/**
 * @desc    Get all announcements ordered by most recent (with memory caching)
 * @route   GET /api/announcements
 * @access  Public
 */
exports.getAnnouncements = async (req, res) => {
  try {
    const cachedData = announcementCache.get("announcements_feed");
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    const announcements = await Announcement.find()
      .sort({ createdAt: -1 })
      .lean(); 

    announcementCache.set("announcements_feed", announcements);
    return res.status(200).json(announcements);
  } catch (err) {
    console.error("❌ [Get Announcements Failure]:", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch sanctuary updates." });
  }
};

/**
 * @desc    Delete an announcement by Object ID
 * @route   DELETE /api/announcements/:id
 * @access  Private (Admin Only)
 */
exports.deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    
    const target = await Announcement.findById(id);
    if (!target) {
      return res.status(404).json({ success: false, message: "Announcement target record not found." });
    }

    await Announcement.findByIdAndDelete(id);
    announcementCache.del("announcements_feed"); 

    return res.status(200).json({ success: true, message: "Broadcast record permanently dropped." });
  } catch (err) {
    console.error("❌ [Delete Announcement Failure]:", err.message);
    return res.status(500).json({ success: false, message: "Operational server execution failure during deletion." });
  }
};