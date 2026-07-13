const LevelStudent = require('../models/LevelStudent');
const GroupPhoto = require('../models/GroupPhoto');

// --- STUDENT ROSTER CONTROLLERS ---

// @desc    Add a new student to a level
// @route   POST /api/levels/students
const createStudent = async (req, res) => {
  try {
    const { 
      fullName, imageUrl, skills, state, 
      homeOfResidence, email, phoneNumber, level, academicYear 
    } = req.body;

    // Convert comma-separated skills string into an array if sent as text
    const formattedSkills = Array.isArray(skills) 
      ? skills 
      : skills?.split(',').map(skill => skill.trim()).filter(Boolean) || [];

    const newStudent = await LevelStudent.create({
      fullName,
      imageUrl,
      skills: formattedSkills,
      state,
      homeOfResidence,
      email,
      phoneNumber,
      level,
      academicYear
    });

    res.status(201).json({ success: true, data: newStudent });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get students by level and academic year
// @route   GET /api/levels/students?level=100-Level&year=2026/2027
const getStudents = async (req, res) => {
  try {
    const { level, year } = req.query;
    
    const query = {};
    if (level) query.level = level;
    if (year) query.academicYear = year;

    const students = await LevelStudent.find(query).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: students.length, data: students });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- GROUP PHOTO CONTROLLERS ---

// @desc    Add or Update Level Group Photo
// @route   POST /api/levels/group-photo
const saveGroupPhoto = async (req, res) => {
  try {
    const { levelName, academicYear, imageUrl, caption } = req.body;

    // Automatically update if that year's photo already exists, or create new
    const groupPhoto = await GroupPhoto.findOneAndUpdate(
      { levelName, academicYear },
      { imageUrl, caption },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({ success: true, data: groupPhoto });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get Level Group Photo
// @route   GET /api/levels/group-photo?level=100-Level&year=2026/2027
const getGroupPhoto = async (req, res) => {
  try {
    const { level, year } = req.query;

    const photo = await GroupPhoto.findOne({ levelName: level, academicYear: year });
    
    // 🟢 Instead of res.status(404), return 200 with data: null so React doesn't crash!
    if (!photo) {
      return res.status(200).json({ 
        success: true, 
        data: null, 
        message: 'No group photo uploaded for this session yet.' 
      });
    }

    res.status(200).json({ success: true, data: photo });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createStudent,
  getStudents,
  saveGroupPhoto,
  getGroupPhoto
};