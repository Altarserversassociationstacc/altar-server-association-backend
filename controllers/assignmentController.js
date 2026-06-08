const Assignment = require('../models/Assignment');
const Student = require('../models/Student');

/**
 * @desc    Fetch all mass deployments (Used by MassSelection calendar)
 * @route   GET /api/admin/assignments/history
 */
exports.getAssignmentHistory = async (req, res) => {
    try {
        const { month, year } = req.query;
        let query = {};

        // Optimize calendar fetching by filtering by month/year prefix
        if (month && year) {
            const formattedMonth = month.toString().padStart(2, '0');
            query.assignmentDate = { $regex: `^${year}-${formattedMonth}` };
        }

        const assignments = await Assignment.find(query).sort({ assignmentDate: -1, assignmentTime: -1 });
        
        res.status(200).json({ success: true, data: assignments });
    } catch (error) {
        console.error("Fetch History Error:", error);
        res.status(500).json({ success: false, message: 'Failed to synchronize ledger history.' });
    }
};

/**
 * @desc    Create a new mass deployment roster
 * @route   POST /api/admin/mass-assignments
 */
exports.createAssignment = async (req, res) => {
    try {
        // 🛠️ SMART FIX: Safely grab the admin ID whether the middleware mapped it to admin or user
        const identity = req.admin || req.user;
        
        if (!identity || !identity._id) {
            return res.status(401).json({ success: false, message: 'Authentication verification failed: Admin context missing.' });
        }

        const newAssignment = new Assignment({
            ...req.body,
            deployedByAdmin: identity._id 
        });
        
        await newAssignment.save();
        
        res.status(201).json({ success: true, data: newAssignment });
    } catch (error) {
        console.error("Deployment Error:", error.message);
        // Catch duplicate key errors gracefully
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'A deployment already exists for this exact date and time.' });
        }
        res.status(500).json({ success: false, message: 'Failed to broadcast deployment.' });
    }
};

/**
 * @desc    Search assignments where a specific student is assigned
 * @route   GET /api/admin/student/my-assignments/search
 */
exports.searchAssignmentsByStudentName = async (req, res) => {
    try {
        const { name } = req.query;
        if (!name) return res.status(400).json({ success: false, message: 'Search parameter missing.' });

        // Strip titles from the search query to maximize finding a match
        const cleanName = name.replace(/^(bro\.*|sis\.*|brother|sister|mr\.*|mrs\.*|miss)\s+/i, '').trim();
        const regexName = new RegExp(cleanName, 'i'); // Case-insensitive "contains" search

        const rolesList = [
            'sacristan', 'masterOfCeremonies', 'firstAcolyte', 'secondAcolyte', 
            'crossBearer', 'thurifer', 'boatBearer', 'firstAuxiliary', 
            'secondAuxiliary', 'mitreBearer', 'crosierBearer'
        ];
        
        // 🛠️ BACKWARD COMPATIBILITY QUERY: Searches both the new structured 'roles' object AND the old flat layout
        const searchConditions = [];
        rolesList.forEach(role => {
            searchConditions.push({ [`roles.${role}.name`]: regexName }); // New schema
            searchConditions.push({ [role]: regexName }); // Old schema
        });

        const assignments = await Assignment.find({ $or: searchConditions }).sort({ assignmentDate: -1 });

        res.status(200).json({ success: true, data: assignments });
    } catch (error) {
        console.error("Search Error:", error);
        res.status(500).json({ success: false, message: 'Failed to execute search query.' });
    }
};

/**
 * @desc    Core Attendance Engine (With Title Sanitizer & Schema Bridge)
 * @route   PUT /api/admin/mass-assignments/:id/attendance
 */
exports.updateMassAttendance = async (req, res) => {
    try {
        const { id } = req.params;
        const { semester, attendance } = req.body;

        const assignment = await Assignment.findById(id);
        if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found.' });

        if (!assignment.attendance) assignment.attendance = new Map();
        
        for (const [roleKey, newStatus] of Object.entries(attendance)) {
            const previousStatus = assignment.attendance.get(roleKey);
            
            // 🛠️ THE SCHEMA BRIDGE: Read the name from the new object format first. If empty, fall back to old format.
            let rawStudentName = '';
            if (assignment.roles && assignment.roles[roleKey] && assignment.roles[roleKey].name) {
                rawStudentName = assignment.roles[roleKey].name;
            } else {
                rawStudentName = assignment.get(roleKey); 
            }

            if (!rawStudentName || rawStudentName.trim() === '') continue;

            if (previousStatus !== newStatus) {
                assignment.attendance.set(roleKey, newStatus);
                
                // Name Sanitizer: Removes "Bro ", "Sis ", etc.
                const cleanStudentName = rawStudentName.replace(/^(bro\.*|sis\.*|brother|sister|mr\.*|mrs\.*|miss)\s+/i, '').trim();
                
                // 🛠️ PROFESSIONAL FUZZY SEARCH: Finds the student even if the name is slightly mismatched in the DB
                const student = await Student.findOne({ 
                    fullName: { $regex: new RegExp(cleanStudentName, 'i') } 
                });
                
                if (student) {
                    if (!student.performanceHistory) student.performanceHistory = [];
                    let historyIndex = student.performanceHistory.findIndex(h => h.semester === semester);
                    
                    if (historyIndex === -1) {
                        student.performanceHistory.push({ semester, levelAtTime: student.currentLevel || 'Unknown', massesAssigned: 1, massesServed: 0 });
                        historyIndex = student.performanceHistory.length - 1;
                    }

                    // Logic: Update count only when status moves to "Served" or falls back to "Missed"
                    if (newStatus === 'Served') {
                        student.performanceHistory[historyIndex].massesServed += 1;
                    } else if (newStatus === 'Missed' && previousStatus === 'Served') {
                        student.performanceHistory[historyIndex].massesServed = Math.max(0, student.performanceHistory[historyIndex].massesServed - 1);
                    }

                    await student.save();
                } else {
                    console.warn(`[Attendance Warning] Student "${cleanStudentName}" (Original: "${rawStudentName}") not found in DB.`);
                }
            }
        }

        await assignment.save();
        res.status(200).json({ success: true, message: 'Attendance records updated.' });
    } catch (error) {
        console.error("Attendance Engine Crash:", error);
        res.status(500).json({ success: false, message: 'Server error during attendance processing.' });
    }
};

/**
 * @desc    Single Mass Confirmation Logic (Fired from Dashboard)
 * @route   POST /api/admin/mark-mass-served
 */
exports.markMassServed = async (req, res) => {
    try {
        // 1. Accept studentId from the request body so Admins can update Students
        const { assignmentId, studentId } = req.body;
        
        if (!assignmentId || !studentId) {
            return res.status(400).json({ success: false, message: 'Assignment ID and Student ID are required.' });
        }

        const assignment = await Assignment.findById(assignmentId);
        if (!assignment) {
            return res.status(404).json({ success: false, message: 'Assignment record not found.' });
        }

        const currentSemester = assignment.semester;

        // 2. Fetch the student to check their current data
        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student record not found.' });
        }

        // 3. IDEMPOTENCY CHECK: Did we already credit them for this specific assignment?
        // (Assuming you add a `servedAssignments` array to your Student schema to track this)
        if (student.servedAssignments && student.servedAssignments.includes(assignmentId)) {
            return res.status(200).json({ success: true, message: 'Service record was already verified previously.' });
        }

     // 4. ATOMIC DATABASE UPDATES
        const historyIndex = student.performanceHistory?.findIndex(h => h.semester === currentSemester);

        if (historyIndex !== -1) {
            const updateQuery = {};
            // Update the semester array...
            updateQuery[`performanceHistory.${historyIndex}.massesServed`] = 1;
            // AND update the global metric!
            updateQuery[`activityMetrics.massesCount`] = 1; 

            await Student.findByIdAndUpdate(studentId, {
                $inc: updateQuery,
                $addToSet: { servedAssignments: assignmentId } 
            });
        } else {
            // Push a brand new semester record AND increment the global metric
            await Student.findByIdAndUpdate(studentId, {
                $inc: { "activityMetrics.massesCount": 1 },
                $push: {
                    performanceHistory: {
                        semester: currentSemester,
                        levelAtTime: student.currentLevel || 'Unknown',
                        massesAssigned: 1, 
                        massesServed: 1
                    }
                },
                $addToSet: { servedAssignments: assignmentId }
            });
        }

        return res.status(200).json({ success: true, message: 'Service record successfully verified.' });
    } catch (error) {
        console.error("Mark Served Error:", error);
        return res.status(500).json({ success: false, message: 'Failed to verify service record.' });
    }
};