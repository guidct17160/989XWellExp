const dbStore = require('../services/dbStore');

// GET /api/announcements
exports.getAnnouncements = async (req, res) => {
  try {
    const list = await dbStore.getAnnouncements();
    return res.status(200).json({
      success: true,
      total: list.length,
      announcements: list,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/announcements/:id
exports.getAnnouncementById = async (req, res) => {
  try {
    const item = await dbStore.getAnnouncementById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'ไม่พบประกาศข่าวสาร' });
    }
    return res.status(200).json({ success: true, announcement: item });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/announcements
exports.createAnnouncement = async (req, res) => {
  try {
    const { title, content, category, isPinned, imageUrl } = req.body;
    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุหัวข้อและเนื้อหาประกาศ' });
    }

    const newAnno = await dbStore.addAnnouncement({
      title,
      content,
      category,
      isPinned,
      imageUrl,
      author: req.user?.name || 'HR Admin',
    });

    return res.status(201).json({
      success: true,
      message: 'สร้างประกาศข่าวสารเรียบร้อยแล้ว',
      announcement: newAnno,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/announcements/:id
exports.deleteAnnouncement = async (req, res) => {
  try {
    await dbStore.deleteAnnouncement(req.params.id);
    return res.status(200).json({
      success: true,
      message: 'ลบประกาศข่าวสารเรียบร้อยแล้ว',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
