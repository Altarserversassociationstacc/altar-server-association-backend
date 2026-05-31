// const jwt = require('jsonwebtoken');
// const Admin = require('../models/Admin');

// const protect = async (req, res, next) => {
//   let token;

//   if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
//     try {
//       token = req.headers.authorization.split(' ')[1];

//       if (!process.env.JWT_SECRET) {
//         console.error("🚨 [Critical] JWT_SECRET is missing from environment variables.");
//         return res.status(500).json({ message: 'Internal server configuration error' });
//       }

//       const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
//       // ✅ Injects admin profile entity straight into request pipeline context
//       req.admin = await Admin.findById(decoded.id).select('-password');

//       if (!req.admin) {
//         return res.status(401).json({ message: 'Not authorized, account no longer exists' });
//       }

//       return next();
//     } catch (error) {
//       console.error(`❌ [Auth Error]: ${error.name} - ${error.message}`);
//       return res.status(401).json({ 
//         message: error.name === 'TokenExpiredError' ? 'Session expired' : 'Not authorized, token invalid' 
//       });
//     }
//   }

//   if (!token) {
//     return res.status(401).json({ message: 'Not authorized, no token provided' });
//   }
// };

// // ✅ ADDED: Professional Role-Based Access Control Interceptor
// const adminGate = (req, res, next) => {
//   // Checks req.admin since your protect middleware attaches the profile there
//   if (req.admin && req.admin.role === 'admin') {
//     return next();
//   }
  
//   return res.status(403).json({ 
//     success: false, 
//     message: 'Access Denied: High-level administrative clearance privileges required.' 
//   });
// };

// // ⚠️ FIXED: Exporting both functions inside the object wrapper to clear the Express crash
// module.exports = { 
//   protect, 
//   adminGate 
// };
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
// 📝 Simply import your Student model at the top
const Student = require('../models/Student'); 

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];

      if (!process.env.JWT_SECRET) {
        console.error("🚨 [Critical] JWT_SECRET is missing from environment variables.");
        return res.status(500).json({ message: 'Internal server configuration error' });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // =========================================================
      // 🔒 YOUR ORIGINAL CODE (100% untouched for admin stability)
      // =========================================================
      req.admin = await Admin.findById(decoded.id).select('-password');

      // =========================================================
      // 🛡️ THE SAFETY BRIDGE (Only runs if req.admin is null/Student)
      // =========================================================
      if (!req.admin && Student) {
        // If the ID isn't an Admin, look for them in the Student collection
        const studentUser = await Student.findById(decoded.id).select('-password');
        
        if (studentUser) {
          // Attach them to req.admin anyway so NONE of your old routes crash!
          req.admin = studentUser; 
          req.isStudent = true; // Optional flag in case you need to differentiate later
        }
      }

      // =========================================================
      // YOUR ORIGINAL FINAL GATE CHECK
      // =========================================================
      if (!req.admin) {
        return res.status(401).json({ message: 'Not authorized, account no longer exists' });
      }

      return next();
    } catch (error) {
      console.error(`❌ [Auth Error]: ${error.name} - ${error.message}`);
      return res.status(401).json({ 
        message: error.name === 'TokenExpiredError' ? 'Session expired' : 'Not authorized, token invalid' 
      });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }
};

// Original Admin Gate (Stays exactly the same)
const adminGate = (req, res, next) => {
  // If they are a student masquerading through the protect pipeline, block them from Admin writes
  if (req.admin && req.admin.role === 'admin' && !req.isStudent) {
    return next();
  }
  
  return res.status(403).json({ 
    success: false, 
    message: 'Access Denied: High-level administrative clearance privileges required.' 
  });
};

module.exports = { 
  protect, 
  adminGate 
};