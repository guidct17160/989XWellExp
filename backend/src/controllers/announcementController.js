const dbStore = require('../services/dbStore');
const httpError = require('../utils/httpError');
const { send: sendError } = httpError;
const { bangkokParts } = require('../utils/time');
const { logAudit } = require('../utils/auditLogger');

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const text = (v) => String(v === undefined || v === null ? '' : v).trim();
const nowKey = () => {
  const now = bangkokParts();
  return `${now.dateIso} ${String(now.hour).padStart(2, '0')}:${String(now.minute).padStart(2, '0')}`;
};

// "data:image/png;base64,...." -> { type, data } after checking the real file content, never the claimed type
const parseImage = (dataUrl) => {
  const m = /^data:image\/(png|gif);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(String(dataUrl || ''));
  if (!m) throw httpError(400, 'The image must be a PNG or GIF file');
  const data = Buffer.from(m[2], 'base64');
  if (data.length === 0 || data.length > MAX_IMAGE_BYTES) throw httpError(400, 'The image must be 5 MB or smaller');
  let type = null;
  if (data.length > 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    type = 'image/png';
  } else if (data.length > 6 && /^GIF8[79]a$/.test(data.subarray(0, 6).toString('latin1'))) {
    type = 'image/gif';
  }
  if (!type) throw httpError(400, 'The image must be a PNG or GIF file');
  return { type, data };
};

// Validates the form body. `image`: undefined = not sent (keep), null = remove, data URL = new picture
const cleanAnnouncement = (body = {}) => {
  const title = text(body.title);
  if (!title) throw httpError(400, 'Title is required');
  if (title.length > 255) throw httpError(400, 'Title must be 255 characters or fewer');
  const description = text(body.description);
  if (!description) throw httpError(400, 'Description is required');
  if (description.length > 5000) throw httpError(400, 'Description must be 5,000 characters or fewer');

  const startDate = text(body.startDate);
  const startTime = text(body.startTime) || '00:00';
  if (!ISO_DATE.test(startDate)) throw httpError(400, 'Start date is required');
  if (!TIME.test(startTime)) throw httpError(400, 'Start time must be HH:mm');

  const noEndDate = body.noEndDate === true;
  let endDate = null;
  let endTime = null;
  if (!noEndDate) {
    endDate = text(body.endDate);
    endTime = text(body.endTime) || '00:00';
    if (!ISO_DATE.test(endDate)) throw httpError(400, 'End date is required (or tick "No end date")');
    if (!TIME.test(endTime)) throw httpError(400, 'End time must be HH:mm');
    if (`${endDate} ${endTime}` <= `${startDate} ${startTime}`) throw httpError(400, 'End date / time must be after the start date / time');
  }

  let image;
  if (body.image === null) image = null;
  else if (body.image !== undefined) image = parseImage(body.image);

  return { title, description, startDate, startTime, endDate, endTime, image };
};

// the picture is served by its own URL; the web builds it from the id, the app needs a full address
const withImageUrl = (req, a) => {
  const { hasImage, imageVersion, ...rest } = a;
  return {
    ...rest,
    hasImage,
    imageUrl: hasImage ? `${req.protocol}://${req.get('host')}${req.baseUrl}/announcements/${a.id}/image?v=${imageVersion}` : null,
  };
};

// GET /api/announcements  (public: only what is published right now - this is what the app shows)
exports.getAnnouncements = async (req, res) => {
  try {
    const list = (await dbStore.getAnnouncements({ activeOnly: true })).map((a) => withImageUrl(req, a));
    return res.status(200).json({ success: true, total: list.length, announcements: list });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /api/announcements/all  (admins: everything, with its Scheduled / Active / Expired status)
exports.getAllAnnouncements = async (req, res) => {
  try {
    const list = (await dbStore.getAnnouncements()).map((a) => withImageUrl(req, a));
    return res.status(200).json({ success: true, total: list.length, announcements: list });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /api/announcements/:id
exports.getAnnouncementById = async (req, res) => {
  try {
    const item = await dbStore.getAnnouncementById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'ไม่พบประกาศข่าวสาร' });
    return res.status(200).json({ success: true, announcement: withImageUrl(req, item) });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /api/announcements/:id/image
exports.getAnnouncementImage = async (req, res) => {
  try {
    const image = await dbStore.getAnnouncementImage(req.params.id);
    if (!image) return res.status(404).json({ success: false, message: 'Image not found' });
    res.set('Content-Type', image.type);
    res.set('Cache-Control', 'public, max-age=300');
    // helmet defaults to same-origin, which stops the app (another origin, e.g. :8081) from showing this picture
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    return res.status(200).send(image.data);
  } catch (error) {
    return sendError(res, error);
  }
};

// POST /api/announcements
exports.createAnnouncement = async (req, res) => {
  try {
    const data = cleanAnnouncement(req.body);
    if (data.endDate && `${data.endDate} ${data.endTime}` < nowKey()) throw httpError(400, 'End date / time cannot be earlier than the current time');
    const created = await dbStore.addAnnouncement({ ...data, image: data.image || null, author: req.user?.name || req.user?.username || 'HR Admin' });
    logAudit(req, { action: 'CREATE_ANNOUNCEMENT', resourceType: 'announcement', resourceId: created.id, details: { title: created.title } }).catch(() => {});
    return res.status(201).json({ success: true, message: 'Announcement created', announcement: withImageUrl(req, created) });
  } catch (error) {
    return sendError(res, error);
  }
};

// PUT /api/announcements/:id
exports.updateAnnouncement = async (req, res) => {
  try {
    const data = cleanAnnouncement(req.body);
    const existing = await dbStore.getAnnouncementById(req.params.id);
    if (!existing) throw httpError(404, 'Announcement not found');
    // an unchanged end date may already be in the past (an expired announcement being edited)
    const endChanged = data.endDate !== existing.endDate || data.endTime !== existing.endTime;
    if (data.endDate && endChanged && `${data.endDate} ${data.endTime}` < nowKey()) throw httpError(400, 'End date / time cannot be earlier than the current time');
    const updated = await dbStore.updateAnnouncement(req.params.id, data);
    logAudit(req, { action: 'UPDATE_ANNOUNCEMENT', resourceType: 'announcement', resourceId: updated.id, details: { title: updated.title } }).catch(() => {});
    return res.status(200).json({ success: true, message: 'Announcement updated', announcement: withImageUrl(req, updated) });
  } catch (error) {
    return sendError(res, error);
  }
};

// DELETE /api/announcements/:id
exports.deleteAnnouncement = async (req, res) => {
  try {
    const existing = await dbStore.getAnnouncementById(req.params.id);
    await dbStore.deleteAnnouncement(req.params.id);
    logAudit(req, { action: 'DELETE_ANNOUNCEMENT', resourceType: 'announcement', resourceId: req.params.id, details: { title: existing ? existing.title : null } }).catch(() => {});
    return res.status(200).json({ success: true, message: 'Announcement deleted' });
  } catch (error) {
    return sendError(res, error);
  }
};
