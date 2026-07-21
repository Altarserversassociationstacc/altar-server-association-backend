const Meeting = require('../models/Meeting');
const User = require('../models/Student');

const METRIC_WEIGHTS = {
  MEETINGS: 0.4,
  MASSES: 0.4,
  OTHER_TASKS: 0.2,
  MAX_OTHER_CAP: 100,
  OTHER_MULTIPLIER: 10
};

const VALID_SEMESTERS = Object.freeze(['Harmattan Semester', 'Rain Semester']);

// @desc    Admin: Get all meetings
// @route   GET /api/admin/meetings
exports.getMeetingsList = async (req, res) => {
  try {
    const meetings = await Meeting.find().sort({ eventDate: -1 });
    return res.status(200).json({ success: true, count: meetings.length, meetings });
  } catch (err) {
    console.error('[GetMeetingsList Error]:', err);
    return res.status(500).json({ success: false, message: 'Server error while fetching meetings.' });
  }
};

// @desc    Admin: Create a new meeting instance
// @route   POST /api/admin/meetings
exports.createMeeting = async (req, res) => {
  try {
    // FIX: Extracted academicYear from req.body
    const { title, dateString, day, semester, academicYear } = req.body;

    if (!title || !dateString || !day || !semester) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: title, dateString, day, and semester are mandatory.' 
      });
    }

    if (!VALID_SEMESTERS.includes(semester)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid semester. Must be one of: ${VALID_SEMESTERS.join(', ')}` 
      });
    }

    const parsedDate = new Date(dateString);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid dateString provided. Cannot parse to a valid Date.' 
      });
    }

    const newMeeting = await Meeting.create({
      title: title.trim(),
      day: day.trim(),
      dateString,
      semester,
      academicYear, // FIX: Persisted to database
      eventDate: parsedDate
    });

    return res.status(201).json({ 
      success: true,
      message: 'Meeting session initialized successfully.', 
      meeting: newMeeting 
    });
  } catch (err) {
    console.error('[CreateMeeting Error]:', err);
    return res.status(500).json({ success: false, message: 'Internal server error during meeting creation.' });
  }
};

// @desc    Admin: Update existing meeting session metadata
// @route   PUT /api/admin/meetings/:id
exports.updateMeeting = async (req, res) => {
  try {
    const { id } = req.params;
    // FIX: Extracted academicYear from req.body
    const { title, dateString, day, semester, academicYear } = req.body;

    const meeting = await Meeting.findById(id);
    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Meeting session not found.' });
    }

    if (semester && !VALID_SEMESTERS.includes(semester)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid semester. Must be one of: ${VALID_SEMESTERS.join(', ')}` 
      });
    }

    let parsedDate = meeting.eventDate;
    if (dateString) {
      parsedDate = new Date(dateString);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid dateString provided.' });
      }
    }

    const updatedMeeting = await Meeting.findByIdAndUpdate(
      id,
      {
        $set: {
          title: title ? title.trim() : meeting.title,
          day: day ? day.trim() : meeting.day,
          dateString: dateString || meeting.dateString,
          semester: semester || meeting.semester,
          academicYear: academicYear || meeting.academicYear, // FIX: Updated in database
          eventDate: parsedDate
        }
      },
      { returnDocument: 'after', runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Meeting session successfully updated.',
      meeting: updatedMeeting
    });
  } catch (err) {
    console.error('[UpdateMeeting Error]:', err);
    return res.status(500).json({ success: false, message: 'Server error during meeting update.' });
  }
};

// @desc    Admin: Delete a meeting session and trigger background metrics sync
// @route   DELETE /api/admin/meetings/:id
exports.deleteMeeting = async (req, res) => {
  try {
    const { id } = req.params;

    const meeting = await Meeting.findByIdAndDelete(id);
    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Meeting session not found.' });
    }

    if (meeting.attendanceList && meeting.attendanceList.length > 0) {
      Promise.all(
        meeting.attendanceList.map(studentId => 
          calculateAndSyncStudentMetrics(studentId, meeting.semester)
        )
      ).catch(syncErr => {
        console.error(`[Background Sync Error] Failed to update metrics after deleting meeting ${id}:`, syncErr);
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Meeting session successfully deleted.',
      deletedMeetingId: id
    });
  } catch (err) {
    console.error('[DeleteMeeting Error]:', err);
    return res.status(500).json({ success: false, message: 'Server error during meeting deletion.' });
  }
};

// @desc    Admin: Toggle attendance status for a student (Present <-> Absent)
// @route   PUT /api/admin/meetings/:meetingId/toggle-attendance
exports.toggleAttendance = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { studentId } = req.body;

    if (!studentId) {
      return res.status(400).json({ success: false, message: 'studentId is required in the request body.' });
    }

    const meetingExists = await Meeting.exists({ _id: meetingId });
    if (!meetingExists) {
      return res.status(404).json({ success: false, message: 'Meeting session not found.' });
    }

    const isPresent = await Meeting.exists({ _id: meetingId, attendanceList: studentId });
    let updatedMeeting;
    let status;

    if (isPresent) {
      updatedMeeting = await Meeting.findByIdAndUpdate(
        meetingId,
        { $pull: { attendanceList: studentId } },
        { returnDocument: 'after' }
      );
      status = 'absent';
    } else {
      updatedMeeting = await Meeting.findByIdAndUpdate(
        meetingId,
        { $addToSet: { attendanceList: studentId } },
        { returnDocument: 'after' }
      );
      status = 'present';
    }

    try {
      await calculateAndSyncStudentMetrics(studentId, updatedMeeting.semester);
    } catch (metricErr) {
      console.error(`[Metrics Sync Failed] Student: ${studentId}, Semester: ${updatedMeeting.semester}`, metricErr);
    }

    return res.status(200).json({ 
      success: true,
      message: `Student status successfully updated to ${status}.`, 
      meeting: updatedMeeting 
    });
  } catch (err) {
    console.error('[ToggleAttendance Error]:', err);
    return res.status(500).json({ success: false, message: 'Server error while toggling attendance.' });
  }
};

async function calculateAndSyncStudentMetrics(studentId, currentSemester) {
  const student = await User.findById(studentId).select('accountStatus currentLevel activityMetrics');
  if (!student) return;

  if (student.accountStatus === 'Dormant') {
    await User.findByIdAndUpdate(studentId, {
      $set: { "activityMetrics.standing": 'Dormant (IT Session Sync)' }
    });
    return;
  }

  const currentLevel = student.currentLevel || '100L';

  const [totalMeetingsInSem, attendedMeetingsInSem] = await Promise.all([
    Meeting.countDocuments({ semester: currentSemester }),
    Meeting.countDocuments({ semester: currentSemester, attendanceList: studentId })
  ]);
  
  const meetingPercent = totalMeetingsInSem > 0 
    ? Math.round((attendedMeetingsInSem / totalMeetingsInSem) * 100) 
    : 0;

  const massPercent = student.activityMetrics?.massPercent || 0;
  const otherCount = student.activityMetrics?.otherActivitiesCount || 0;

  const normalizedOtherScore = Math.min(
    METRIC_WEIGHTS.MAX_OTHER_CAP, 
    otherCount * METRIC_WEIGHTS.OTHER_MULTIPLIER
  );

  const overallPercent = Math.round(
    (meetingPercent * METRIC_WEIGHTS.MEETINGS) + 
    (massPercent * METRIC_WEIGHTS.MASSES) + 
    (normalizedOtherScore * METRIC_WEIGHTS.OTHER_TASKS)
  );

  let standing = 'Very Poor';
  if (overallPercent >= 90) standing = 'Very Good';
  else if (overallPercent >= 70) standing = 'Good';
  else if (overallPercent >= 50) standing = 'Fair';

  await User.findByIdAndUpdate(studentId, {
    $set: {
      "activityMetrics.meetingCount": attendedMeetingsInSem,
      "activityMetrics.meetingTotal": totalMeetingsInSem,
      "activityMetrics.meetingPercent": meetingPercent,
      "activityMetrics.overallPercent": overallPercent,
      "activityMetrics.standing": standing,
      "activityMetrics.lastEvaluatedSemester": currentSemester,
      "activityMetrics.lastEvaluatedLevel": currentLevel
    }
  });
}