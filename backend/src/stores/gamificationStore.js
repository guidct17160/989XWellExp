const crypto = require('crypto');
const db = require('../config/database');
const memoryStore = require('./memoryStore');
const httpError = require('../utils/httpError');
const { todayIso } = require('../utils/time');

const requireEmpId = (employeeId) => {
  if (!employeeId) throw httpError(401, 'กรุณาเข้าสู่ระบบก่อนทำรายการ');
  return employeeId;
};

// Run fn inside a PostgreSQL transaction (rolls back on any thrown error)
const withTx = async (fn) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
    throw e;
  } finally {
    client.release();
  }
};

module.exports = function createGamificationStore(storeRef) {
  const store = {
    // POINTS HISTORY & BALANCES (100% Real DB Data)
    getPointHistory: async (employeeId) => {
      const empId = requireEmpId(employeeId);
      if (db.isPgConnected()) {
        try {
          const empRes = await db.query('SELECT id, points FROM employees WHERE id = $1 OR code = $1', [empId]);
          let currentPoints = 0;
          let canonicalId = empId;
          if (empRes.rows && empRes.rows.length > 0) {
            currentPoints = parseInt(empRes.rows[0].points, 10) || 0;
            canonicalId = empRes.rows[0].id;
          }
          const txRes = await db.query(
            'SELECT * FROM point_transactions WHERE employee_id = $1 OR employee_id = $2 ORDER BY created_at DESC',
            [empId, canonicalId]
          );
          const history = (txRes.rows || []).map((r) => ({
            id: r.id,
            title: r.title,
            points: r.points,
            type: r.type,
            category: r.category,
            date: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : todayIso(),
            createdAt: r.created_at,
          }));
          return { currentPoints, history };
        } catch (e) {
          console.error('PG query error in getPointHistory:', e);
        }
      }
      if (memoryStore.memoryPointHistory[empId]) {
        return memoryStore.memoryPointHistory[empId];
      }
      return {
        currentPoints: 0,
        history: []
      };
    },

    // Points balance + ledger row are written in ONE transaction. A spend can never take the balance below 0.
    addPointTransaction: async (employeeId, title, points, type = 'earn', category = 'ทั่วไป') => {
      const empId = requireEmpId(employeeId);
      const amount = Math.abs(Number(points) || 0);
      const diff = type === 'spend' ? -amount : amount;
      const txId = `pt-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
      let newTotal = 0;

      if (db.isPgConnected()) {
        try {
          newTotal = await withTx(async (client) => {
            const upd = await client.query(
              diff < 0
                ? 'UPDATE employees SET points = COALESCE(points, 0) + $1 WHERE (id = $2 OR code = $2) AND COALESCE(points, 0) + $1 >= 0 RETURNING id, points'
                : 'UPDATE employees SET points = COALESCE(points, 0) + $1 WHERE (id = $2 OR code = $2) RETURNING id, points',
              [diff, empId]
            );
            if (!upd.rows || upd.rows.length === 0) {
              throw httpError(400, diff < 0 ? 'คะแนนสะสมไม่เพียงพอ' : 'ไม่พบบัญชีพนักงานสำหรับบันทึกคะแนน');
            }
            await client.query(
              'INSERT INTO point_transactions (id, employee_id, title, points, type, category) VALUES ($1, $2, $3, $4, $5, $6)',
              [txId, upd.rows[0].id, title || 'คะแนนสะสม', diff, type, category]
            );
            return parseInt(upd.rows[0].points, 10) || 0;
          });
        } catch (e) {
          if (e && e.status) throw e;
          console.error('PG error in addPointTransaction:', e);
          throw new Error('ไม่สามารถบันทึกคะแนนลงฐานข้อมูลได้');
        }
      }

      if (!memoryStore.memoryPointHistory[empId]) {
        memoryStore.memoryPointHistory[empId] = { currentPoints: newTotal, history: [] };
      }
      const current = memoryStore.memoryPointHistory[empId];
      current.currentPoints = db.isPgConnected() ? newTotal : Math.max(0, current.currentPoints + diff);
      current.history.unshift({
        id: txId,
        title: title || 'คะแนนสะสม',
        points: diff,
        type: type,
        category: category,
        date: todayIso(),
      });
      return current;
    },

    // REWARDS
    getRewards: async () => {
      if (db.isPgConnected()) {
        try {
          const res = await db.query("SELECT * FROM rewards WHERE status = 'Active' ORDER BY points_required ASC");
          if (res.rows && res.rows.length > 0) {
            return res.rows.map(r => ({
              id: r.id,
              title: r.title,
              description: r.description,
              pointsRequired: Number.isNaN(parseInt(r.points_required, 10)) ? 0 : parseInt(r.points_required, 10),
              category: r.category || 'Voucher',
              categoryId: r.category_id || null,
              imageUrl: r.image_url,
              // stock 0 means SOLD OUT (do not turn it into 100)
              stock: r.stock === null || r.stock === undefined ? 100 : parseInt(r.stock, 10) || 0,
              status: r.status || 'Active',
            }));
          }
          return [];
        } catch (e) {
          console.error('PG query error in getRewards:', e);
        }
      }
      return memoryStore.memoryRewards;
    },

    getRewardById: async (id) => {
      const rewards = await (storeRef ? storeRef.getRewards() : store.getRewards());
      return rewards.find(r => r.id === id) || null;
    },

    // REWARD CATEGORIES (admin managed; a reward points at one of them)
    getRewardCategories: async () => {
      if (db.isPgConnected()) {
        try {
          const res = await db.query(
            `SELECT c.id, c.code, c.name, c.created_at, COUNT(r.id)::int AS reward_count
               FROM reward_categories c LEFT JOIN rewards r ON r.category_id = c.id
              GROUP BY c.id ORDER BY LOWER(COALESCE(c.code, '')), LOWER(c.name)`
          );
          return res.rows.map(r => ({ id: r.id, code: r.code || '', name: r.name, rewardCount: r.reward_count, createdAt: r.created_at }));
        } catch (e) {
          console.error('PG query error in getRewardCategories:', e);
          throw new Error('ไม่สามารถอ่านหมวดหมู่ของรางวัลจากฐานข้อมูลได้');
        }
      }
      return memoryStore.memoryRewardCategories.map(c => ({
        ...c,
        rewardCount: memoryStore.memoryRewards.filter(r => r.categoryId === c.id).length,
      }));
    },

    // Short running code (CAT-005) used when the admin does not type their own code
    nextRewardCategoryCode: async () => {
      let max = 0;
      if (db.isPgConnected()) {
        const r = await db.query("SELECT COALESCE(MAX(SUBSTRING(code FROM '^CAT-([0-9]{1,6})$')::int), 0) AS n FROM reward_categories");
        max = r.rows[0].n;
      } else {
        memoryStore.memoryRewardCategories.forEach((x) => { const m = /^CAT-(\d{1,6})$/.exec(x.code || ''); if (m) max = Math.max(max, Number(m[1])); });
      }
      return `CAT-${String(max + 1).padStart(3, '0')}`;
    },

    addRewardCategory: async ({ name, code }) => {
      const cat = { id: `rcat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, code: code || (await store.nextRewardCategoryCode()), name, createdAt: new Date().toISOString() };
      if (db.isPgConnected()) {
        for (let attempt = 0; ; attempt++) {
          try {
            await db.query('INSERT INTO reward_categories (id, code, name) VALUES ($1, $2, $3)', [cat.id, cat.code, cat.name]);
            break;
          } catch (e) {
            if (e && e.code === '23505') {
              if (!/code/.test(e.constraint || '')) throw httpError(409, `Category "${name}" already exists`);
              if (code) throw httpError(409, `Category code "${code}" is already used, please choose another code`);
              if (attempt < 3) { cat.code = await store.nextRewardCategoryCode(); continue; }
            }
            console.error('PG insert error in addRewardCategory:', e);
            throw new Error('ไม่สามารถบันทึกหมวดหมู่ลงฐานข้อมูลได้');
          }
        }
      } else {
        const list = memoryStore.memoryRewardCategories;
        if (list.some(c => c.name.toLowerCase() === name.toLowerCase())) throw httpError(409, `Category "${name}" already exists`);
        if (list.some(c => String(c.code).toLowerCase() === cat.code.toLowerCase())) throw httpError(409, `Category code "${cat.code}" is already used, please choose another code`);
      }
      memoryStore.memoryRewardCategories.push(cat);
      return { ...cat, rewardCount: 0 };
    },

    updateRewardCategory: async (id, { name, code }) => {
      if (db.isPgConnected()) {
        // renaming also rewrites the display name on every reward in the category; an empty code keeps the current one
        return withTx(async (client) => {
          let upd;
          try {
            upd = await client.query(
              'UPDATE reward_categories SET name = $2, code = COALESCE($3, code) WHERE id = $1 RETURNING id, code, name, created_at',
              [id, name, code || null]
            );
          } catch (e) {
            if (e && e.code === '23505') {
              throw httpError(409, /code/.test(e.constraint || '') ? `Category code "${code}" is already used, please choose another code` : `Category "${name}" already exists`);
            }
            throw e;
          }
          if (!upd.rowCount) throw httpError(404, 'Category not found');
          await client.query('UPDATE rewards SET category = $2 WHERE category_id = $1', [id, name]);
          const cnt = await client.query('SELECT COUNT(*)::int AS n FROM rewards WHERE category_id = $1', [id]);
          return { id, code: upd.rows[0].code, name: upd.rows[0].name, createdAt: upd.rows[0].created_at, rewardCount: cnt.rows[0].n };
        });
      }
      const list = memoryStore.memoryRewardCategories;
      const cat = list.find(c => c.id === id);
      if (!cat) throw httpError(404, 'Category not found');
      if (list.some(c => c.id !== id && c.name.toLowerCase() === name.toLowerCase())) throw httpError(409, `Category "${name}" already exists`);
      if (code && list.some(c => c.id !== id && String(c.code).toLowerCase() === code.toLowerCase())) throw httpError(409, `Category code "${code}" is already used, please choose another code`);
      cat.name = name;
      if (code) cat.code = code;
      memoryStore.memoryRewards.forEach(r => { if (r.categoryId === id) r.category = name; });
      return { ...cat, rewardCount: memoryStore.memoryRewards.filter(r => r.categoryId === id).length };
    },

    deleteRewardCategory: async (id) => {
      if (db.isPgConnected()) {
        const used = await db.query('SELECT COUNT(*)::int AS n FROM rewards WHERE category_id = $1', [id]);
        if (used.rows[0].n > 0) {
          throw httpError(409, `This category is used by ${used.rows[0].n} reward(s). Move or delete those rewards first`);
        }
        try {
          const del = await db.query('DELETE FROM reward_categories WHERE id = $1', [id]);
          if (!del.rowCount) throw httpError(404, 'Category not found');
        } catch (e) {
          if (e && e.status) throw e;
          if (e && e.code === '23503') throw httpError(409, 'This category is still used by rewards');
          console.error('PG delete error in deleteRewardCategory:', e);
          throw new Error('ไม่สามารถลบหมวดหมู่ออกจากฐานข้อมูลได้');
        }
        return true;
      }
      if (memoryStore.memoryRewards.some(r => r.categoryId === id)) throw httpError(409, 'This category is still used by rewards');
      memoryStore.memoryRewardCategories = memoryStore.memoryRewardCategories.filter(c => c.id !== id);
      return true;
    },

    // Short running code (rew-005) used when the admin does not type their own code
    nextRewardCode: async () => {
      let max = 0;
      if (db.isPgConnected()) {
        const r = await db.query("SELECT COALESCE(MAX(SUBSTRING(id FROM '^rew-([0-9]{1,6})$')::int), 0) AS n FROM rewards");
        max = r.rows[0].n;
      } else {
        memoryStore.memoryRewards.forEach((x) => { const m = /^rew-(\d{1,6})$/.exec(x.id); if (m) max = Math.max(max, Number(m[1])); });
      }
      return `rew-${String(max + 1).padStart(3, '0')}`;
    },

    addReward: async (data) => {
      const pointsRequired = parseInt(data.pointsRequired, 10);
      const stockRaw = parseInt(data.stock, 10);

      // a reward is filed under one of the admin-defined categories (when given); the name is copied for display
      let categoryId = null;
      let categoryName = data.category || 'Voucher';
      if (data.categoryId) {
        const cats = await store.getRewardCategories();
        const cat = cats.find(c => c.id === data.categoryId);
        if (!cat) throw httpError(400, 'The selected category no longer exists');
        categoryId = cat.id;
        categoryName = cat.name;
      }

      const newRew = {
        id: data.code || (await store.nextRewardCode()),
        title: data.title,
        description: data.description || '',
        pointsRequired: Number.isNaN(pointsRequired) ? 100 : Math.max(0, pointsRequired),
        category: categoryName,
        categoryId,
        imageUrl: data.imageUrl || 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=300',
        stock: Number.isNaN(stockRaw) ? 100 : Math.max(0, stockRaw),
        status: data.status || 'Active',
      };
      if (db.isPgConnected()) {
        if (data.code) {
          const dup = await db.query('SELECT 1 FROM rewards WHERE LOWER(id) = LOWER($1)', [data.code]);
          if (dup.rowCount) throw httpError(409, `Reward code "${data.code}" is already used, please choose another code`);
        }
        // an auto code can collide with a reward created at the same moment, so retry with the next number
        for (let attempt = 0; ; attempt++) {
          try {
            await db.query(
              `INSERT INTO rewards (id, title, description, points_required, category, category_id, image_url, stock, status)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
              [newRew.id, newRew.title, newRew.description, newRew.pointsRequired, newRew.category, newRew.categoryId, newRew.imageUrl, newRew.stock, newRew.status]
            );
            break;
          } catch (e) {
            if (e && e.code === '23505') {
              if (data.code) throw httpError(409, `Reward code "${data.code}" is already used, please choose another code`);
              if (attempt < 3) { newRew.id = await store.nextRewardCode(); continue; }
            }
            console.error('PG insert error in addReward:', e);
            throw new Error('ไม่สามารถบันทึกของรางวัลลงฐานข้อมูลได้');
          }
        }
      } else if (data.code && memoryStore.memoryRewards.some((x) => x.id.toLowerCase() === data.code.toLowerCase())) {
        throw httpError(409, `Reward code "${data.code}" is already used, please choose another code`);
      }
      memoryStore.memoryRewards.unshift(newRew);
      return newRew;
    },

    deleteReward: async (id) => {
      if (db.isPgConnected()) {
        try {
          await db.query('DELETE FROM rewards WHERE id = $1', [id]);
        } catch (e) {
          console.error('PG delete error in deleteReward:', e);
          if (e && e.code === '23503') {
            throw httpError(409, 'ไม่สามารถลบของรางวัลที่มีประวัติการแลกแล้ว');
          }
          throw new Error('ไม่สามารถลบของรางวัลออกจากฐานข้อมูลได้');
        }
      }
      memoryStore.memoryRewards = memoryStore.memoryRewards.filter(r => r.id !== id);
      return true;
    },

    redeemReward: async (employeeId, rewardId) => {
      const empId = requireEmpId(employeeId);
      const couponCode = `WX-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

      if (db.isPgConnected()) {
        // Everything (stock, points, coupon, ledger) in ONE transaction with row locks:
        // no double-spend, no overselling, no negative balance.
        try {
          return await withTx(async (client) => {
            const rw = await client.query("SELECT * FROM rewards WHERE id = $1 AND status = 'Active' FOR UPDATE", [rewardId]);
            if (!rw.rows || rw.rows.length === 0) throw httpError(404, 'ไม่พบของรางวัลนี้');
            const reward = rw.rows[0];
            const cost = parseInt(reward.points_required, 10) || 0;
            if ((parseInt(reward.stock, 10) || 0) <= 0) throw httpError(400, 'ของรางวัลนี้หมดแล้ว');

            const em = await client.query('SELECT id, points FROM employees WHERE id = $1 OR code = $1 FOR UPDATE', [empId]);
            if (!em.rows || em.rows.length === 0) throw httpError(404, 'ไม่พบบัญชีพนักงาน');
            const emp = em.rows[0];
            const have = parseInt(emp.points, 10) || 0;
            if (have < cost) {
              throw httpError(400, `คะแนนไม่เพียงพอ (ต้องการ ${cost} แต้ม แต่คุณมี ${have} แต้ม)`);
            }

            await client.query('UPDATE rewards SET stock = stock - 1 WHERE id = $1', [rewardId]);
            await client.query('UPDATE employees SET points = COALESCE(points, 0) - $1 WHERE id = $2', [cost, emp.id]);

            const redemption = {
              id: `red-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
              employeeId: emp.id,
              rewardId,
              rewardTitle: reward.title,
              rewardImage: reward.image_url,
              couponCode,
              pointsUsed: cost,
              status: 'Active',
              createdAt: todayIso(),
            };
            await client.query(
              `INSERT INTO redemptions (id, employee_id, reward_id, coupon_code, points_used, status)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [redemption.id, emp.id, rewardId, couponCode, cost, 'Active']
            );
            await client.query(
              'INSERT INTO point_transactions (id, employee_id, title, points, type, category) VALUES ($1, $2, $3, $4, $5, $6)',
              [`pt-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`, emp.id, `แลกของรางวัล: ${reward.title}`, -cost, 'spend', 'ของรางวัล (Reward)']
            );
            redemption.newTotalPoints = have - cost;
            return redemption;
          });
        } catch (e) {
          if (e && e.status) throw e;
          console.error('PG error in redeemReward:', e);
          throw new Error('ไม่สามารถแลกของรางวัลได้ กรุณาลองใหม่อีกครั้ง');
        }
      }

      // ---- Memory fallback (PostgreSQL not connected) ----
      const reward = await (storeRef ? storeRef.getRewardById : store.getRewardById)(rewardId);
      if (!reward) throw httpError(404, 'ไม่พบของรางวัลนี้');
      if (reward.stock !== undefined && reward.stock <= 0) throw httpError(400, 'ของรางวัลนี้หมดแล้ว');
      const pointData = await (storeRef ? storeRef.getPointHistory : store.getPointHistory)(empId);
      if ((pointData?.currentPoints || 0) < reward.pointsRequired) {
        throw httpError(400, `คะแนนไม่เพียงพอ (ต้องการ ${reward.pointsRequired} แต้ม แต่คุณมี ${pointData?.currentPoints || 0} แต้ม)`);
      }
      const newRedemption = {
        id: `red-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        employeeId: empId,
        rewardId: rewardId,
        rewardTitle: reward.title,
        rewardImage: reward.imageUrl,
        couponCode: couponCode,
        pointsUsed: reward.pointsRequired,
        status: 'Active',
        createdAt: todayIso(),
      };
      memoryStore.memoryRedemptions.unshift(newRedemption);
      reward.stock = Math.max(0, (reward.stock || 0) - 1);
      await (storeRef ? storeRef.addPointTransaction : store.addPointTransaction)(
        empId,
        `แลกของรางวัล: ${reward.title}`,
        reward.pointsRequired,
        'spend',
        'ของรางวัล (Reward)'
      );
      return newRedemption;
    },

    getUserCoupons: async (employeeId) => {
      const empId = requireEmpId(employeeId);
      if (db.isPgConnected()) {
        try {
          const res = await db.query(
            `SELECT r.*, rew.title as reward_title, rew.image_url as reward_image, rew.category as reward_category
             FROM redemptions r
             LEFT JOIN rewards rew ON r.reward_id = rew.id
             WHERE (r.employee_id = $1 OR r.employee_id IN (SELECT code FROM employees WHERE id = $1) OR r.employee_id IN (SELECT id FROM employees WHERE code = $1))
             ORDER BY r.created_at DESC`,
            [empId]
          );
          if (res.rows) {
            return res.rows.map(r => ({
              id: r.id,
              employeeId: r.employee_id,
              rewardId: r.reward_id,
              title: r.reward_title || 'คูปองสิทธิพิเศษ',
              imageUrl: r.reward_image || null,
              category: r.reward_category || 'สิทธิพิเศษ',
              couponCode: r.coupon_code,
              pointsUsed: parseInt(r.points_used, 10) || 0,
              status: r.status || 'พร้อมใช้งาน',
              createdAt: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : '',
            }));
          }
        } catch (e) {
          console.error('PG query error in getUserCoupons:', e);
        }
      }
      return memoryStore.memoryRedemptions.filter(r => r.employeeId === empId);
    },
  };

  return store;
};
