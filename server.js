const express = require('express');
const dotenv = require('dotenv');
const dns = require('dns');
const path = require('path');

// 🎯 CRITICAL BOOT SEQUENCE: Load configuration BEFORE requiring local routes/controllers
dns.setServers(['8.8.8.8', '8.8.4.4']); 
dotenv.config(); 

const mongoose = require('mongoose');
const cors = require('cors');

// App Routers
const studentRoutes = require('./routes/student'); 
const notificationRoutes = require('./routes/notification'); 
const executiveRoutes = require('./routes/executiveRoutes'); 
const adminRoutes = require('./routes/adminRoutes'); 
const adminApprovalRoutes = require('./routes/admin'); 
const announcementRoutes = require('./routes/announcementRoutes'); 
const eventRoutes = require('./routes/eventRoutes'); 
const galleryRoutes = require('./routes/galleryRoutes'); 

const app = express();
const PORT = process.env.PORT || 10000; 

// Professional Security Alignment: Dynamic Vite & Local Port Matrix Whitelisting
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'http://localhost:5173', 
    'http://localhost:5174', 
    process.env.FRONTEND_URL, // Whitelists your frontend URL variable
    process.env.CLIENT_URL    // ✅ FIXED: Safely whitelists CLIENT_URL too so CORS never blocks you!
  ].filter(Boolean),          // Cleans out any undefined environment values safely
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'user-id'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database Lifecycle
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hostel_db', {
      serverSelectionTimeoutMS: 5000, 
      socketTimeoutMS: 45000,
      family: 4 
    });
    console.log(`\x1b[38;5;208mMongoDB Connected: ${conn.connection.host}\x1b[0m`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
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

  // Fallbacks & Error Handlers
  app.use((req, res, next) => {
    res.status(404).json({ success: false, message: `API Route Not Found: ${req.method} ${req.originalUrl}` });
  });

  app.use((err, req, res, next) => {
    console.error(`\x1b[31m[Server Error]\x1b[0m`, err);
    res.status(err.status || 500).json({ success: false, message: err.message || 'Internal Server Error' });
  });

  // The '0.0.0.0' is essential for Render to see your server
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running live on port ${PORT}`);
  });
};

// 🛡️ CRITICAL FAULT TOLERANCE MATRIX LAYER
process.on('unhandledRejection', (reason, promise) => {
  console.error('\x1b[33m[Anti-Crash Guard] Unhandled Rejection intercepted:\x1b[0m', reason);
});

process.on('uncaughtException', (error) => {
  console.error('\x1b[31m[Anti-Crash Guard] Uncaught Exception intercepted:\x1b[0m', error.message);
});

startServer();