const mongoose = require('mongoose');

const FeeConfigSchema = new mongoose.Schema({
  narration: { 
    type: String, 
    required: true, 
    unique: true // Ensures 'Sessional Dues' only has one master entry
  },
  amount: { 
    type: Number, 
    required: true 
  }
}, { timestamps: true });

module.exports = mongoose.model('FeeConfig', FeeConfigSchema);