const Admin = require('../models/Admin');
const bcrypt = require('bcryptjs');

const seedDefaultAdmin = async () => {
  try {
    const email = process.env.ADMIN_EMAIL;
    const rawPassword = process.env.ADMIN_PASSWORD;
    if (!email || !rawPassword) {
      console.warn('\x1b[33m[Seed Service] Missing ADMIN_EMAIL or ADMIN_PASSWORD in .env. Skipping admin seed.\x1b[0m');
      return; 
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(rawPassword, salt);
    
    await Admin.findOneAndUpdate(
      { email },
      {
        fullName: 'System Administrator',
        email,
        password: hashedPassword,
        mustChangePassword: true
      },
      { upsert: true, returnDocument: 'after',setDefaultsOnInsert: true }
    );
    console.log(`\x1b[32m[Seed Service] Default Admin Synchronized for: ${email}\x1b[0m`);
    
  } catch (error) {
    console.error('\x1b[31m[Seed Service Error]:\x1b[0m', error.message);
  }
};

module.exports = seedDefaultAdmin;