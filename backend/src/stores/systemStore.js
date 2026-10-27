const db = require('../config/database');
const memoryStore = require('./memoryStore');
const httpError = require('../utils/httpError');
const { bangkokParts } = require('../utils/time');

// Scheduled / Active / Expired follows Thai local time (dates are YYYY-MM-DD, times HH:mm, so strings compare correctly).
// An announcement without an end date never expires.
const announcementStatus = (a) => {
  const now = bangkokParts();
  const nowKey = `${now.dateIso} ${String(now.hour).padStart(2, '0')}:${String(now.minute).padStart(2, '0')}`;
  if (nowKey < `${a.startDate} ${a.startTime}`) return 'Scheduled';
  if (a.endDate && nowKey > `${a.endDate} ${a.endTime}`) return 'Expired';
  return 'Active';
};

const stamp = (value) => {
  if (!value) return { date: '', time: '' };
  const p = bangkokParts(new Date(value));
  return { date: p.dateIso, time: `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}` };
};

const mapAnnouncement = (r) => {
  const created = stamp(r.created_at);
  const startDate = r.start_date || created.date; // rows saved before publishing windows existed start when they were created
  const startTime = r.start_time || created.time || '00:00';
  const item = {
    id: r.id,
    title: r.title,
    description: r.content,
    content: r.content,
    desc: r.content,
    author: r.author,
    isPinned: !!r.is_pinned,
    hasImage: !!r.has_image,
    imageVersion: r.updated_at ? new Date(r.updated_at).getTime() : 0,
    startDate,
    startTime,
    endDate: r.end_date || null,
    endTime: r.end_date ? r.end_time || '23:59' : null,
    noEndDate: !r.end_date,
    createdAt: r.created_at,
    createdDate: created.date,
    createdTime: created.time,
    time: created.date,
  };
  item.status = announcementStatus(item);
  return item;
};

const needPg = () => {
  if (!db.isPgConnected()) throw httpError(503, 'ต้องเชื่อมต่อฐานข้อมูลเพื่อจัดการประกาศ');
};

const ANNO_COLUMNS = 'id, title, content, author, is_pinned, created_at, updated_at, start_date, start_time, end_date, end_time, (image_data IS NOT NULL) AS has_image';

module.exports = function createSystemStore(storeRef) {
  const store = {
    // SETTINGS
    getSettings: async () => {
      if (db.isPgConnected()) {
        try {
          const res = await db.query("SELECT value FROM system_settings WHERE key = 'app_settings'");
          if (res.rows && res.rows.length > 0) {
            return { ...memoryStore.memorySettings, ...res.rows[0].value };
          }
        } catch (e) {
          console.error('PG error in getSettings:', e);
        }
      }
      return memoryStore.memorySettings;
    },

    updateSettings: async (newSettings) => {
      // Merge onto the CURRENT stored settings (PostgreSQL), not just the in-memory defaults,
      // otherwise a partial update after a restart would wipe every other saved key.
      const current = await (storeRef ? storeRef.getSettings() : { ...memoryStore.memorySettings });
      const merged = { ...current, ...newSettings };
      if (db.isPgConnected()) {
        try {
          await db.query(
            `INSERT INTO system_settings (key, value) VALUES ('app_settings', $1)
             ON CONFLICT (key) DO UPDATE SET value = $1`,
            [JSON.stringify(merged)]
          );
        } catch (e) {
          console.error('PG update error in updateSettings:', e);
          throw new Error('ไม่สามารถบันทึกการตั้งค่าระบบลงฐานข้อมูลได้');
        }
      }
      memoryStore.memorySettings = merged;
      return memoryStore.memorySettings;
    },

    // ANNOUNCEMENTS (real database only; the image is kept as bytes and served by /announcements/:id/image)
    getAnnouncements: async ({ activeOnly = false } = {}) => {
      if (!db.isPgConnected()) return [];
      const res = await db.query(`SELECT ${ANNO_COLUMNS} FROM announcements ORDER BY created_at DESC`);
      const list = res.rows.map(mapAnnouncement);
      return activeOnly ? list.filter((a) => a.status === 'Active') : list;
    },

    getAnnouncementById: async (id) => {
      if (!db.isPgConnected()) return null;
      const res = await db.query(`SELECT ${ANNO_COLUMNS} FROM announcements WHERE id = $1`, [id]);
      return res.rows[0] ? mapAnnouncement(res.rows[0]) : null;
    },

    getAnnouncementImage: async (id) => {
      if (!db.isPgConnected()) return null;
      const res = await db.query('SELECT image_data, image_type FROM announcements WHERE id = $1 AND image_data IS NOT NULL', [id]);
      return res.rows[0] ? { type: res.rows[0].image_type, data: res.rows[0].image_data } : null;
    },

    // data: { title, description, startDate, startTime, endDate|null, endTime|null, author, image: { type, data } | null }
    addAnnouncement: async (data) => {
      needPg();
      const id = `anno-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      try {
        await db.query(
          `INSERT INTO announcements (id, title, content, author, start_date, start_time, end_date, end_time, image_data, image_type)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [id, data.title, data.description, data.author, data.startDate, data.startTime, data.endDate, data.endTime,
            data.image ? data.image.data : null, data.image ? data.image.type : null]
        );
      } catch (e) {
        console.error('PG insert error in addAnnouncement:', e);
        throw new Error('ไม่สามารถบันทึกประกาศลงฐานข้อมูลได้');
      }
      return store.getAnnouncementById(id);
    },

    // image: undefined = keep the current one, null = remove it, { type, data } = replace it
    updateAnnouncement: async (id, data) => {
      needPg();
      const sets = ['title = $2', 'content = $3', 'start_date = $4', 'start_time = $5', 'end_date = $6', 'end_time = $7', 'updated_at = CURRENT_TIMESTAMP'];
      const params = [id, data.title, data.description, data.startDate, data.startTime, data.endDate, data.endTime];
      if (data.image === null) {
        sets.push('image_data = NULL', 'image_type = NULL');
      } else if (data.image) {
        params.push(data.image.data, data.image.type);
        sets.push(`image_data = $${params.length - 1}`, `image_type = $${params.length}`);
      }
      let upd;
      try {
        upd = await db.query(`UPDATE announcements SET ${sets.join(', ')} WHERE id = $1`, params);
      } catch (e) {
        console.error('PG update error in updateAnnouncement:', e);
        throw new Error('ไม่สามารถแก้ไขประกาศในฐานข้อมูลได้');
      }
      if (!upd.rowCount) throw httpError(404, 'Announcement not found');
      return store.getAnnouncementById(id);
    },

    deleteAnnouncement: async (id) => {
      needPg();
      try {
        const del = await db.query('DELETE FROM announcements WHERE id = $1', [id]);
        if (!del.rowCount) throw httpError(404, 'Announcement not found');
      } catch (e) {
        if (e && e.status) throw e;
        console.error('PG delete error in deleteAnnouncement:', e);
        throw new Error('ไม่สามารถลบประกาศออกจากฐานข้อมูลได้');
      }
      return true;
    },

    // NOTIFICATIONS
    addNotification: async (data) => {
      const newNotif = {
        id: `${data.id || 'notif'}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        employeeId: data.employeeId,
        title: data.title,
        message: data.message,
        type: data.type || 'info',
        isRead: false,
        createdAt: data.createdAt || new Date().toISOString(),
      };
      memoryStore.memoryNotifications.unshift(newNotif);

      if (db.isPgConnected()) {
        try {
          await db.query(
            `INSERT INTO notifications (id, employee_id, title, message, type, is_read, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
             ON CONFLICT (id) DO NOTHING`,
            [newNotif.id, newNotif.employeeId, newNotif.title, newNotif.message, newNotif.type, false]
          );
        } catch (e) {
          console.error('PG insert error in addNotification:', e);
        }
      }

      return newNotif;
    },

    getNotifications: async (employeeId) => {
      if (db.isPgConnected()) {
        try {
          let query = 'SELECT * FROM notifications';
          const params = [];
          if (employeeId) {
            params.push(employeeId);
            query += ' WHERE employee_id = $1';
          }
          query += ' ORDER BY created_at DESC';
          const res = await db.query(query, params);
          if (res.rows && res.rows.length > 0) {
            const pgNotifs = res.rows.map((r) => ({
              id: r.id,
              employeeId: r.employee_id,
              title: r.title,
              message: r.message,
              type: r.type,
              isRead: r.is_read,
              createdAt: r.created_at,
            }));
            // Merge with memory-only notifications not yet persisted
            const pgIds = new Set(pgNotifs.map((n) => n.id));
            const memOnly = memoryStore.memoryNotifications.filter((n) => !pgIds.has(n.id) && (n.employeeId === employeeId || !employeeId));
            return [...memOnly, ...pgNotifs];
          }
        } catch (e) {
          console.error('PG query error in getNotifications:', e);
        }
      }
      return memoryStore.memoryNotifications.filter((n) => n.employeeId === employeeId || !employeeId);
    },

    markNotificationRead: async (id, employeeId) => {
      const n = memoryStore.memoryNotifications.find((x) => x.id === id && (!employeeId || x.employeeId === employeeId));
      if (n) n.isRead = true;
      if (db.isPgConnected()) {
        try {
          if (employeeId) {
            await db.query('UPDATE notifications SET is_read = true WHERE id = $1 AND employee_id = $2', [id, employeeId]);
          } else {
            await db.query('UPDATE notifications SET is_read = true WHERE id = $1', [id]);
          }
        } catch (e) {
          console.error('PG update error in markNotificationRead:', e);
        }
      }
      return n;
    },

    markAllNotificationsRead: async (employeeId) => {
      memoryStore.memoryNotifications.forEach((n) => {
        if (n.employeeId === employeeId || !employeeId) n.isRead = true;
      });
      if (db.isPgConnected()) {
        try {
          if (employeeId) {
            await db.query('UPDATE notifications SET is_read = true WHERE employee_id = $1', [employeeId]);
          } else {
            await db.query('UPDATE notifications SET is_read = true');
          }
        } catch (e) {
          console.error('PG update error in markAllNotificationsRead:', e);
        }
      }
      return true;
    },

    savePushToken: async (employeeId, token) => {
      memoryStore.memoryPushTokens[employeeId] = token;
      return true;
    },
  };
  return store;
};
