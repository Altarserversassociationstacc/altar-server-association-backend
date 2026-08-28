const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const dns = require('dns'); 

dotenv.config({ path: path.join(__dirname, '.env') });

// Global DNS servers to bypass local ISP timeouts
dns.setServers(['8.8.8.8', '8.8.4.4']); 

// App Routers
const studentRoutes = require('./routes/student'); 
const notificationRoutes = require('./routes/notification'); 
const executiveRoutes = require('./routes/executiveRoutes'); 
const adminRoutes = require('./routes/adminRoutes'); 
const adminApprovalRoutes = require('./routes/admin'); 
const announcementRoutes = require('./routes/announcementRoutes'); 
const eventRoutes = require('./routes/eventRoutes'); 
const galleryRoutes = require('./routes/galleryRoutes'); 
const paymentRouter = require('./routes/paymentRoutes');
const levelRoutes = require('./routes/levelRoutes'); 

const app = express();
const PORT = process.env.PORT || 10000; 

// Dynamic Origin Whitelisting
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'http://localhost:5173', 
    'http://localhost:5174', 
    process.env.CLIENT_URL,
    process.env.ADMIN_URL   
  ].filter(Boolean),          
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'user-id'],
  credentials: true
}));

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database Lifecycle with Auto Index Cleanup
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hostel_db', {
      serverSelectionTimeoutMS: 5000, 
      socketTimeoutMS: 45000,
    });
    console.log(`\x1b[38;5;208mMongoDB Connected: ${conn.connection.host}\x1b[0m`);

    // AUTO-PURGE LEGACY INDEX (Solves the E11000 matrix crash)
    try {
      await conn.connection.db.collection('feeconfigs').dropIndex('narration_1');
      console.log('\x1b[32m[DB Maintenance] Successfully dropped legacy narration_1 index.\x1b[0m');
    } catch (err) {
      // Index is already removed or does not exist — safe to ignore
    }

  } catch (error) {
    console.error(`\x1b[31mMongoDB Connection Error: ${error.message}\x1b[0m`);
    process.exit(1);
  }
};

const startServer = async () => {
  await connectDB();

  // Mount Endpoints
  app.use('/api/student', studentRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/admin-approvals', adminApprovalRoutes);
  app.use('/api/executives', executiveRoutes); 
  app.use('/api/admin/announcements', announcementRoutes);
  app.use('/api/events', eventRoutes); 
  app.use('/api/gallery', galleryRoutes); 
  app.use('/api/notifications', notificationRoutes); 
  app.use('/api/payment', paymentRouter);
  app.use('/api/levels', levelRoutes);

  // Fallbacks & 404 Handler
  app.use((req, res) => {
    res.status(404).json({ success: false, message: `API Route Not Found: ${req.method} ${req.originalUrl}` });
  });

  // Global Error Processing Pipeline
  app.use((err, req, res, next) => {
    console.error(`\x1b[31m[Server Error]\x1b[0m`, err);
    res.status(err.status || 500).json({ 
      success: false, 
      message: err.message || 'Internal Server Error' 
    });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\x1b[32mServer is running live on port ${PORT}\x1b[0m`);
  });
};

// Fault Tolerance Matrix Layer
process.on('unhandledRejection', (reason) => {
  console.error('\x1b[33m[Anti-Crash Guard] Unhandled Rejection intercepted:\x1b[0m', reason);
});

process.on('uncaughtException', (error) => {
  console.error('\x1b[31m[Anti-Crash Guard] Uncaught Exception intercepted:\x1b[0m', error.message);
});

startServer();