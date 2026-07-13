const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const dns = require('dns'); // 👈 1. Import the native DNS module

// Load Environment Variables
dotenv.config();

// Set global DNS servers to Google to bypass local ISP timeouts
dns.setServers(['8.8.8.8', '8.8.4.4']); // 👈 2. Add this line right here!
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

// Professional Security Alignment: Dynamic Vite & Local Port Matrix Whitelisting
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'http://localhost:5173', 
    'http://localhost:5174', 
    // process.env.FRONTEND_URL, 
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

// Database Lifecycle
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hostel_db', {
      serverSelectionTimeoutMS: 5000, 
      socketTimeoutMS: 45000,
      
    });
    console.log(`\x1b[38;5;208mMongoDB Connected: ${conn.connection.host}\x1b[0m`);
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
  app.use((req, res, next) => {
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

// 🛡️ CRITICAL FAULT TOLERANCE MATRIX LAYER
process.on('unhandledRejection', (reason, promise) => {
  console.error('\x1b[33m[Anti-Crash Guard] Unhandled Rejection intercepted:\x1b[0m', reason);
});

process.on('uncaughtException', (error) => {
  console.error('\x1b[31m[Anti-Crash Guard] Uncaught Exception intercepted:\x1b[0m', error.message);
});

startServer();