const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
    // 1. CELEBRATION METADATA
    massTitle: { 
        type: String, 
        required: [true, 'Mass title is required'], 
        trim: true 
    },
    assignmentDate: { 
        type: String, 
        required: [true, 'Assignment date is required'], 
        index: true // ⚡ INDEXED: Makes calendar searches lightning fast
    },
    assignmentTime: { 
        type: String, 
        required: [true, 'Assignment time is required'] 
    },
    serviceType: { 
        type: String, 
        required: true,
        enum: ['Sunday Mass', 'Bishop Mass', 'Weekday Mass', 'Evening Mass'] 
    },
    semester: { 
        type: String, 
        required: true 
    },
    institution: { 
        type: String, 
        trim: true, 
        default: '' 
    },
    hasSecondAcolyte: { 
        type: Boolean, 
        default: true 
    },

    // 2. AUDIT TRAIL
    deployedByAdmin: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Student', // Change to 'Admin' or 'User' depending on your main auth model
        required: true 
    },

    // 3. FLAT ROLES (Legacy Support)
    sacristan: { type: String, trim: true, default: '' },
    masterOfCeremonies: { type: String, trim: true, default: '' },
    firstAcolyte: { type: String, trim: true, default: '' },
    secondAcolyte: { type: String, trim: true, default: '' },
    crossBearer: { type: String, trim: true, default: '' },
    thurifer: { type: String, trim: true, default: '' },
    boatBearer: { type: String, trim: true, default: '' },
    firstAuxiliary: { type: String, trim: true, default: '' },
    secondAuxiliary: { type: String, trim: true, default: '' },
    mitreBearer: { type: String, trim: true, default: '' },
    crosierBearer: { type: String, trim: true, default: '' },

    // 4. STRUCTURED ROLES (This handles the name AND the level natively!)
    roles: { 
        type: mongoose.Schema.Types.Mixed, 
        default: {} 
    },

    // 5. ATTENDANCE ENGINE
    attendance: { 
        type: Map, 
        of: String, 
        default: {} 
    }
}, { 
    timestamps: true 
});

assignmentSchema.index({ assignmentDate: -1, assignmentTime: -1 });

module.exports = mongoose.model('Assignment', assignmentSchema);