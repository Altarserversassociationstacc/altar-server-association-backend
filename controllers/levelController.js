const mongoose = require('mongoose'); // 🟢 ADDED: Required for ObjectId validation
const LevelStudent = require('../models/LevelStudent');
const GroupPhoto = require('../models/GroupPhoto');

const createStudent = async (req, res) => {
  try {
    const { 
      fullName, imageUrl, skills, state, 
      homeOfResidence, email, phoneNumber, level, academicYear 
    } = req.body;

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

const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid student ID format' });
    }

    const student = await LevelStudent.findById(id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    res.status(200).json({ success: true, data: student });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid student ID format' });
    }

    const updatedStudent = await LevelStudent.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updatedStudent) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    res.status(200).json({ success: true, data: updatedStudent });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid student ID format' });
    }

    const deletedStudent = await LevelStudent.findByIdAndDelete(id);

    if (!deletedStudent) {
      return res.status(404).json({ success: false, message: 'Student already removed or does not exist' });
    }

    res.status(200).json({ success: true, message: 'Student successfully removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const saveGroupPhoto = async (req, res) => {
  try {
    const { levelName, academicYear, imageUrl, caption } = req.body;

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

const getGroupPhoto = async (req, res) => {
  try {
    const { level, year } = req.query;

    const photo = await GroupPhoto.findOne({ levelName: level, academicYear: year });
    
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

// 🟢 ADDED: Missing updateGroupPhoto handler
const updateGroupPhoto = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid photo ID format' });
    }

    const updatedPhoto = await GroupPhoto.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    if (!updatedPhoto) {
      return res.status(404).json({ success: false, message: 'Group photo not found' });
    }

    res.status(200).json({ success: true, data: updatedPhoto });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// 🟢 ADDED: Missing deleteGroupPhoto handler
const deleteGroupPhoto = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid photo ID format' });
    }

    const deletedPhoto = await GroupPhoto.findByIdAndDelete(id);
    if (!deletedPhoto) {
      return res.status(404).json({ success: false, message: 'Group photo not found' });
    }

    res.status(200).json({ success: true, message: 'Group photo removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createStudent,
  getStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
  saveGroupPhoto,
  getGroupPhoto,
  updateGroupPhoto, // 🟢 ADDED to exports
  deleteGroupPhoto  // 🟢 ADDED to exports
};