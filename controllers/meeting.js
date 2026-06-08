const Meeting = require('../models/Meeting');
const User = require('../models/Student');

// @desc    Admin: Create a new meeting instance with full calendar metadata
// @route   POST /api/admin/meetings
exports.createMeeting = async (req, res) => {
  try {
    const { title, dateString, day, semester } = req.body;

    // Convert the human-readable string to a valid Date object for system sorting
    const parsedDate = new Date(dateString);

    // 🛡️ Ensure safe fallback for semester if front-end sends wrong data
    const validSemester = ['Harmattan Semester', 'Rain Semester'].includes(semester) 
      ? semester 
      : 'Harmattan Semester';

    const newMeeting = await Meeting.create({
      title,
      day,
      dateString,
      semester: validSemester,
      eventDate: isNaN(parsedDate.getTime()) ? Date.now() : parsedDate
    });

    return res.status(201).json({ 
      success: true,
      message: 'Meeting session initialized successfully.', 
      meeting: newMeeting 
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Database Error: ' + err.message });
  }
};

// @desc    Admin: Toggle attendance status for a student (Present <-> Absent)
// @route   PUT /api/admin/meetings/:meetingId/toggle-attendance
exports.toggleAttendance = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { studentId } = req.body;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) return res.status(404).json({ message: 'Meeting session not found.' });

    const studentIndex = meeting.attendanceList.indexOf(studentId);
    let status = 'present';

    if (studentIndex > -1) {
      meeting.attendanceList.splice(studentIndex, 1);
      status = 'absent';
    } else {
      meeting.attendanceList.push(studentId);
    }

    await meeting.save();

    // Pass the semester context to the calculator to ensure accurate standing
    await calculateAndSyncStudentMetrics(studentId, meeting.semester);

    return res.status(200).json({ 
      success: true,
      message: `Student status successfully updated to ${status}.`, 
      meeting 
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
};

/**
 * @function calculateAndSyncStudentMetrics
 * @description Sophisticated analytics engine that calculates standings based on semester and level partitions.
 */
async function calculateAndSyncStudentMetrics(studentId, currentSemester) {
  const student = await User.findById(studentId);
  if (!student) return;

  // 🛡️ THE DORMANCY GUARD INTERCEPTOR
  if (student.accountStatus === 'Dormant') {
    await User.findByIdAndUpdate(studentId, {
      $set: { "activityMetrics.standing": 'Dormant (IT Session Sync)' }
    });
    return;
  }

  // 🚀 GRAB THE LEVEL: Check the student's current level so we track it correctly
  const currentLevel = student.currentLevel || '100L';

  // 📈 SEMESTER-SPECIFIC CALCULATION
  // We only count meetings belonging to the specific semester passed from the toggle action
  const totalMeetingsInSem = await Meeting.countDocuments({ semester: currentSemester });
  const attendedMeetingsInSem = await Meeting.countDocuments({ 
    semester: currentSemester, 
    attendanceList: studentId 
  });
  
  const meetingPercent = totalMeetingsInSem > 0 ? Math.round((attendedMeetingsInSem / totalMeetingsInSem) * 100) : 0;

  // Pull existing weights for Mass and Other activities from the student record
  const massPercent = student.activityMetrics?.massPercent || 0;
  const otherCount = student.activityMetrics?.otherActivitiesCount || 0;

  // FORMULA: 40% Meetings + 40% Masses + 20% Other Tasks (e.g. Projects)
  const overallPercent = Math.round(
    (meetingPercent * 0.4) + 
    (massPercent * 0.4) + 
    (Math.min(100, otherCount * 10) * 0.2)
  );

  let standing = 'Very Poor';
  if (overallPercent >= 90) standing = 'Very Good';
  else if (overallPercent >= 70) standing = 'Good';
  else if (overallPercent >= 50) standing = 'Fair';

  // 🔄 UPDATE THE DATABASE
  await User.findByIdAndUpdate(studentId, {
    $set: {
      "activityMetrics.meetingCount": attendedMeetingsInSem,
      "activityMetrics.meetingTotal": totalMeetingsInSem,
      "activityMetrics.meetingPercent": meetingPercent,
      "activityMetrics.overallPercent": overallPercent,
      "activityMetrics.standing": standing,
      "activityMetrics.lastEvaluatedSemester": currentSemester, // Harmattan or Rain
      "activityMetrics.lastEvaluatedLevel": currentLevel // Records whether they were 100L, 200L, etc.
    }
  });
}