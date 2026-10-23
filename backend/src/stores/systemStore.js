const db = require('../config/database');
const memoryStore = require('./memoryStore');

module.exports = function createSystemStore(storeRef) {
  return {
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

    // ANNOUNCEMENTS
    getAnnouncements: async () => {
      if (db.isPgConnected()) {
        try {
          const res = await db.query('SELECT * FROM announcements ORDER BY is_pinned DESC, created_at DESC');
          if (res.rows) {
            return res.rows.map((r) => ({
              id: r.id,
              title: r.title,
              content: r.content,
              desc: r.content,
              category: r.category,
              author: r.author,
              isPinned: r.is_pinned,
              imageUrl: r.image_url,
              createdAt: r.created_at,
              time: r.created_at ? new Date(r.created_at).toLocaleDateString('th-TH') : '',
            }));
          }
        } catch (e) {
          console.error('PG query error in getAnnouncements:', e);
        }
      }
      return [];
    },

    getAnnouncementById: async (id) => {
      if (db.isPgConnected()) {
        try {
          const res = await db.query('SELECT * FROM announcements WHERE id = $1', [id]);
          if (res.rows && res.rows.length > 0) {
            const r = res.rows[0];
            return {
              id: r.id,
              title: r.title,
              content: r.content,
              category: r.category,
              author: r.author,
              isPinned: r.is_pinned,
              imageUrl: r.image_url,
              createdAt: r.created_at,
            };
          }
        } catch (e) {
          console.error('PG query error in getAnnouncementById:', e);
        }
      }
      return memoryStore.memoryAnnouncements.find((a) => a.id === id);
    },

    addAnnouncement: async (data) => {
      const newAnno = {
        id: `anno-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: data.title,
        content: data.content,
        category: data.category || 'ประกาศทั่วไป',
        author: data.author || 'HR Admin',
        isPinned: data.isPinned || false,
        imageUrl: data.imageUrl || null,
        createdAt: new Date().toISOString().split('T')[0],
      };
      if (db.isPgConnected()) {
        try {
          await db.query(
            `INSERT INTO announcements (id, title, content, category, author, is_pinned, image_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (id) DO NOTHING`,
            [newAnno.id, newAnno.title, newAnno.content, newAnno.category, newAnno.author, newAnno.isPinned, newAnno.imageUrl]
          );
        } catch (e) {
          console.error('PG insert error in addAnnouncement:', e);
          throw new Error('ไม่สามารถบันทึกประกาศลงฐานข้อมูลได้');
        }
      }
      memoryStore.memoryAnnouncements.unshift(newAnno);

      return newAnno;
    },

    deleteAnnouncement: async (id) => {
      memoryStore.memoryAnnouncements = memoryStore.memoryAnnouncements.filter((a) => a.id !== id);
      if (db.isPgConnected()) {
        try {
          await db.query('DELETE FROM announcements WHERE id = $1', [id]);
        } catch (e) {
          console.error('PG delete error in deleteAnnouncement:', e);
          throw new Error('ไม่สามารถลบประกาศออกจากฐานข้อมูลได้');
        }
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
};
