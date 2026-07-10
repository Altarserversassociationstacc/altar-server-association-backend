const Executive = require('../models/Executive');
const cloudinary = require('cloudinary').v2;

if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

// Bulletproof utility to isolate dynamic asset directory subfolders
const extractPublicId = (url, folderName) => {
  if (!url || !url.includes('cloudinary')) return null;
  try {
    const parts = url.split(`${folderName}/`);
    if (parts.length < 2) return null;
    return `${folderName}/${parts[1].split('.')[0]}`;
  } catch (err) {
    return null;
  }
};

// @desc    Get all individual executives for a given year
// @route   GET /api/executives
exports.getExecutives = async (req, res) => {
  try {
    const { year, group } = req.query;
    const query = {};
    
    if (year) query.sessionYear = year;
    if (group !== undefined) query.isGroupPhoto = group === 'true';

    const executives = await Executive.find(query).sort({ isGroupPhoto: -1, createdAt: 1 });
    
    // Consistent Response Shape
    return res.status(200).json({
      success: true,
      count: executives.length,
      data: executives
    });
  } catch (err) {
    console.error('❌ [Fetch Error]:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve records.' });
  }
};

// @desc    Get the group photo for a specific year
// @route   GET /api/executives/group-photo
exports.getGroupPhoto = async (req, res) => {
  try {
    const { year } = req.query;
    if (!year) return res.status(400).json({ success: false, message: 'Year parameter is required.' });

    const groupPhoto = await Executive.findOne({ isGroupPhoto: true, sessionYear: year }).sort({ createdAt: -1 });
    
    if (!groupPhoto) {
      return res.status(404).json({ success: false, message: 'No group asset found for this session.' });
    }

    return res.status(200).json({
      success: true,
      data: groupPhoto
    });
  } catch (err) {
    console.error('❌ [Group Photo Error]:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve asset.' });
  }
};

// @desc    Create an executive profile or save session group photo
// @route   POST /api/executives
exports.createExecutive = async (req, res) => {
  try {
    const { sessionYear, executiveName, name, position, bio, department, email, phoneNumber, isGroupPhoto } = req.body;
    let imageUrl = req.body.imageUrl || null;
    const isGroup = String(isGroupPhoto) === 'true';

    if (req.file) {
      const b64 = Buffer.from(req.file.buffer).toString('base64');
      const dataURI = `data:${req.file.mimetype};base64,${b64}`;
      const folder = isGroup ? 'executive_group_photos' : 'executive_individual_photos';
      
      const cloudinaryResponse = await cloudinary.uploader.upload(dataURI, { folder });
      imageUrl = cloudinaryResponse.secure_url;
    }

    if (!imageUrl) {
      return res.status(400).json({ success: false, message: 'Executive image asset file is required.' });
    }

    if (isGroup) {
      const groupPhoto = await Executive.findOneAndUpdate(
        { isGroupPhoto: true, sessionYear },
        { sessionYear, executiveName, imageUrl, name: null, position: null, bio: null, department: null, email: null, phoneNumber: null },
        { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
      );
      return res.status(201).json({ success: true, message: 'Session group photo synchronized.', data: groupPhoto });
    } 

    const newExecutive = await Executive.create({
      sessionYear, executiveName, name, position, bio, department, email, phoneNumber, imageUrl, isGroupPhoto: false,
    });
    return res.status(201).json({ success: true, message: 'Executive profile registered.', data: newExecutive });
  } catch (err) {
    console.error('❌ [Create Executive Error]:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// @desc    Update an executive record or group photo
// @route   PUT /api/executives/:id
exports.updateExecutive = async (req, res) => {
  try {
    const { id } = req.params;
    const executive = await Executive.findById(id);
    
    if (!executive) {
      return res.status(404).json({ success: false, message: 'Record not found.' });
    }

    let updateData = { ...req.body };
    if (updateData.isGroupPhoto !== undefined) {
      updateData.isGroupPhoto = String(updateData.isGroupPhoto) === 'true';
    }

    // Handle Cloudinary Image Replacement
    if (req.file) {
      const oldFolder = executive.isGroupPhoto ? 'executive_group_photos' : 'executive_individual_photos';
      const cleanPublicId = extractPublicId(executive.imageUrl, oldFolder);
      
      if (cleanPublicId) {
        await cloudinary.uploader.destroy(cleanPublicId).catch(() => null);
      }

      const b64 = Buffer.from(req.file.buffer).toString('base64');
      const dataURI = `data:${req.file.mimetype};base64,${b64}`;
      const newFolder = String(req.body.isGroupPhoto) === 'true' ? 'executive_group_photos' : 'executive_individual_photos';
      
      const cloudinaryResponse = await cloudinary.uploader.upload(dataURI, { folder: newFolder });
      updateData.imageUrl = cloudinaryResponse.secure_url;
    }

    // Execute Database Update
    const updatedExecutive = await Executive.findByIdAndUpdate(
      id,
      updateData,
      { 
        new: true,           
        runValidators: true, 
        context: 'query'     
      }
    );

    return res.status(200).json({ 
      success: true, 
      message: 'Updated successfully.', 
      data: updatedExecutive 
    });

  } catch (err) {
    console.error("❌ [Update Error]:", err);
    return res.status(500).json({ success: false, message: 'Update failed.' });
  }
};

// @desc    Delete an executive profile and purge cloud assets
// @route   DELETE /api/executives/:id
exports.deleteExecutive = async (req, res) => {
  try {
    const executive = await Executive.findById(req.params.id);
    if (!executive) return res.status(404).json({ success: false, message: 'Record not found.' });

    const folder = executive.isGroupPhoto ? 'executive_group_photos' : 'executive_individual_photos';
    const cleanPublicId = extractPublicId(executive.imageUrl, folder);
    if (cleanPublicId) await cloudinary.uploader.destroy(cleanPublicId).catch(() => null);

    await executive.deleteOne();
    return res.status(200).json({ success: true, message: 'Purged from cloud and database.' });
  } catch (err) {
    console.error("❌ [Deletion Error]:", err);
    return res.status(500).json({ success: false, message: 'Deletion failed.' });
  }
};