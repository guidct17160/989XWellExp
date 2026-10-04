const db = require('../config/database');
const memoryStore = require('./memoryStore');

module.exports = function createGamificationStore(storeRef) {
  const store = {
    // MISSIONS
    getMissions: async (employeeId) => {
      const empId = employeeId || 'EMP-IT-DEV';
      if (db.isPgConnected()) {
        try {
          const res = await db.query(
            `SELECT m.*, 
                    COALESCE(um.current_value, 0) as current_value, 
                    COALESCE(um.is_completed, FALSE) as is_completed, 
                    COALESCE(um.is_claimed, FALSE) as is_claimed
             FROM missions m
             LEFT JOIN user_missions um ON m.id = um.mission_id AND (um.employee_id = $1)
             WHERE m.status = 'Active'
             ORDER BY m.id ASC`,
            [empId]
          );
          if (res.rows && res.rows.length > 0) {
            return res.rows.map((r) => {
              const target = parseInt(r.target_value, 10) || 1;
              const cur = parseInt(r.current_value, 10) || 0;
              const pts = parseInt(r.reward_points, 10) || 10;
              const isCompleted = !!r.is_completed || (cur >= target);
              return {
                id: r.id,
                title: r.title,
                description: r.description,
                desc: r.description,
                targetValue: target,
                targetSteps: target,
                rewardPoints: pts,
                points: pts,
                category: r.category || 'daily',
                icon: r.icon || 'footsteps',
                status: r.status || 'Active',
                currentValue: cur,
                isCompleted: isCompleted,
                isClaimed: !!r.is_claimed,
              };
            });
          }
        } catch (e) {
          console.error('PG query error in getMissions:', e);
        }
      }

      // Memory fallback
      const userM = memoryStore.memoryUserMissions[empId] || {};
      return memoryStore.memoryMissions.filter(m => m.status === 'Active').map(m => {
        const u = userM[m.id] || { currentValue: 0, isCompleted: false, isClaimed: false };
        const isCompleted = u.isCompleted || u.currentValue >= m.targetValue;
        return {
          id: m.id,
          title: m.title,
          description: m.description,
          desc: m.description,
          targetValue: m.targetValue,
          targetSteps: m.targetValue,
          rewardPoints: m.rewardPoints,
          points: m.rewardPoints,
          category: m.category,
          icon: m.icon,
          status: m.status,
          currentValue: u.currentValue,
          isCompleted,
          isClaimed: u.isClaimed,
        };
      });
    },

    addMission: async (data) => {
      const newId = `ms-${Date.now()}`;
      const target = parseInt(data.targetSteps || data.targetValue, 10) || 10000;
      const pts = parseInt(data.rewardPoints || data.points, 10) || 100;
      const newMission = {
        id: newId,
        title: data.title,
        description: data.description || 'ภารกิจสุขภาพพนักงาน',
        targetValue: target,
        rewardPoints: pts,
        category: data.category || 'daily',
        icon: data.icon || 'footsteps',
        status: data.status || 'Active',
        createdAt: new Date().toISOString(),
      };
      memoryStore.memoryMissions.unshift(newMission);

      if (db.isPgConnected()) {
        try {
          await db.query(
            `INSERT INTO missions (id, title, description, target_value, reward_points, category, icon, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO NOTHING`,
            [newMission.id, newMission.title, newMission.description, newMission.targetValue, newMission.rewardPoints, newMission.category, newMission.icon, newMission.status]
          );
        } catch (e) {
          console.error('PG error in addMission:', e);
        }
      }
      return newMission;
    },

    deleteMission: async (id) => {
      memoryStore.memoryMissions = memoryStore.memoryMissions.filter(m => m.id !== id);
      if (db.isPgConnected()) {
        try {
          await db.query('DELETE FROM user_missions WHERE mission_id = $1', [id]);
          await db.query('DELETE FROM missions WHERE id = $1', [id]);
        } catch (e) {
          console.error('PG error in deleteMission:', e);
        }
      }
      return true;
    },

    updateUserSteps: async (employeeId, steps) => {
      const empId = employeeId || 'EMP-IT-DEV';
      if (!memoryStore.memoryUserMissions[empId]) memoryStore.memoryUserMissions[empId] = {};

      memoryStore.memoryMissions.forEach(m => {
        if (m.icon === 'footsteps' || m.title.includes('ก้าว') || m.description.includes('ก้าว')) {
          const isDone = steps >= m.targetValue;
          memoryStore.memoryUserMissions[empId][m.id] = {
            currentValue: steps,
            isCompleted: isDone,
            isClaimed: memoryStore.memoryUserMissions[empId][m.id]?.isClaimed || false,
          };
        }
      });

      if (db.isPgConnected()) {
        try {
          const stepMissions = await db.query(
            `SELECT id, target_value FROM missions WHERE icon = 'footsteps' OR title LIKE '%ก้าว%' OR description LIKE '%ก้าว%'`
          );
          if (stepMissions.rows) {
            for (const m of stepMissions.rows) {
              const isDone = steps >= parseInt(m.target_value, 10);
              await db.query(
                `INSERT INTO user_missions (id, employee_id, mission_id, current_value, is_completed, is_claimed, updated_at)
                 VALUES ($1, $2, $3, $4, $5, FALSE, CURRENT_TIMESTAMP)
                 ON CONFLICT (id) DO UPDATE SET
                   current_value = EXCLUDED.current_value,
                   is_completed = EXCLUDED.is_completed,
                   updated_at = CURRENT_TIMESTAMP`,
                [`um-${empId}-${m.id}`, empId, m.id, steps, isDone]
              );
            }
          }
        } catch (e) {
          console.error('PG error in updateUserSteps:', e);
        }
      }
      return (storeRef ? storeRef.getMissions : store.getMissions)(empId);
    },

    updateMissionProgress: async (employeeId, missionId, progress, isCompleted) => {
      const empId = employeeId || 'EMP-IT-DEV';
      const cleanMissionId = String(missionId);
      const curVal = Number(progress !== undefined ? progress : 1);

      if (!memoryStore.memoryUserMissions[empId]) {
        memoryStore.memoryUserMissions[empId] = {};
      }

      // Check mission target
      let targetVal = 1;
      const memMission = memoryStore.memoryMissions.find(m => m.id === cleanMissionId);
      if (memMission) {
        targetVal = memMission.targetValue || 1;
      }

      const isDone = isCompleted !== undefined ? Boolean(isCompleted) : curVal >= targetVal;

      memoryStore.memoryUserMissions[empId][cleanMissionId] = {
        currentValue: curVal,
        isCompleted: isDone,
        isClaimed: memoryStore.memoryUserMissions[empId][cleanMissionId]?.isClaimed || false,
      };

      if (db.isPgConnected()) {
        try {
          const mRes = await db.query('SELECT target_value FROM missions WHERE id = $1', [cleanMissionId]);
          if (mRes.rows && mRes.rows.length > 0) {
            targetVal = parseInt(mRes.rows[0].target_value, 10) || 1;
          }
          const finalDone = isCompleted !== undefined ? Boolean(isCompleted) : curVal >= targetVal;

          await db.query(
            `INSERT INTO user_missions (id, employee_id, mission_id, current_value, is_completed, is_claimed, updated_at)
             VALUES ($1, $2, $3, $4, $5, FALSE, CURRENT_TIMESTAMP)
             ON CONFLICT (id) DO UPDATE SET
               current_value = EXCLUDED.current_value,
               is_completed = EXCLUDED.is_completed,
               updated_at = CURRENT_TIMESTAMP`,
            [`um-${empId}-${cleanMissionId}`, empId, cleanMissionId, curVal, finalDone]
          );
        } catch (e) {
          console.error('PG error in updateMissionProgress:', e);
        }
      }

      return (storeRef ? storeRef.getMissions : store.getMissions)(empId);
    },

    claimMissionReward: async (employeeId, missionId) => {
      const empId = employeeId || 'EMP-IT-DEV';
      let rewardPoints = 50;
      let missionTitle = 'ภารกิจสุขภาพ';

      if (db.isPgConnected()) {
        try {
          const mRes = await db.query('SELECT title, reward_points FROM missions WHERE id = $1', [missionId]);
          if (mRes.rows && mRes.rows.length > 0) {
            rewardPoints = parseInt(mRes.rows[0].reward_points, 10) || 50;
            missionTitle = mRes.rows[0].title;
          }

          await db.query(
            `INSERT INTO user_missions (id, employee_id, mission_id, current_value, is_completed, is_claimed, updated_at)
             VALUES ($1, $2, $3, 1, TRUE, TRUE, CURRENT_TIMESTAMP)
             ON CONFLICT (id) DO UPDATE SET
               is_completed = TRUE,
               is_claimed = TRUE,
               updated_at = CURRENT_TIMESTAMP`,
            [`um-${empId}-${missionId}`, empId, missionId]
          );
        } catch (e) {
          console.error('PG error in claimMissionReward:', e);
        }
      }

      if (!memoryStore.memoryUserMissions[empId]) memoryStore.memoryUserMissions[empId] = {};
      memoryStore.memoryUserMissions[empId][missionId] = {
        ...(memoryStore.memoryUserMissions[empId][missionId] || {}),
        isCompleted: true,
        isClaimed: true,
      };

      const addPointsFn = storeRef ? storeRef.addPointTransaction : store.addPointTransaction;
      const newPts = await addPointsFn(
        empId,
        `สำเร็จภารกิจ: ${missionTitle}`,
        rewardPoints,
        'earn',
        'ภารกิจ (Mission)'
      );

      return {
        pointsEarned: rewardPoints,
        newTotalPoints: newPts.currentPoints,
      };
    },

    // POINTS HISTORY & BALANCES (100% Real DB Data)
    getPointHistory: async (employeeId) => {
      const empId = employeeId || 'EMP-IT-DEV';
      if (db.isPgConnected()) {
        try {
          const empRes = await db.query('SELECT points FROM employees WHERE id = $1 OR code = $1', [empId]);
          let currentPoints = 0;
          if (empRes.rows && empRes.rows.length > 0) {
            currentPoints = parseInt(empRes.rows[0].points, 10) || 0;
          }
          const txRes = await db.query(
            'SELECT * FROM point_transactions WHERE employee_id = $1 ORDER BY created_at DESC',
            [empId]
          );
          const history = (txRes.rows || []).map((r) => ({
            id: r.id,
            title: r.title,
            points: r.points,
            type: r.type,
            category: r.category,
            date: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
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

    addPointTransaction: async (employeeId, title, points, type = 'earn', category = 'ทั่วไป') => {
      const empId = employeeId || 'EMP-IT-DEV';
      const diff = type === 'spend' ? -Math.abs(points) : Math.abs(points);
      const txId = `pt-${Date.now()}`;
      let newTotal = 0;

      if (db.isPgConnected()) {
        try {
          await db.query(
            'INSERT INTO point_transactions (id, employee_id, title, points, type, category) VALUES ($1, $2, $3, $4, $5, $6)',
            [txId, empId, title || 'คะแนนสะสม', diff, type, category]
          );
          const updateRes = await db.query(
            'UPDATE employees SET points = GREATEST(0, COALESCE(points, 0) + $1) WHERE id = $2 OR code = $2 RETURNING points',
            [diff, empId]
          );
          if (updateRes.rows && updateRes.rows.length > 0) {
            newTotal = parseInt(updateRes.rows[0].points, 10) || 0;
          }
        } catch (e) {
          console.error('PG insert error in addPointTransaction:', e);
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
        date: new Date().toISOString().split('T')[0],
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
              pointsRequired: parseInt(r.points_required, 10) || 100,
              category: r.category || 'Voucher',
              imageUrl: r.image_url,
              stock: parseInt(r.stock, 10) || 100,
              status: r.status || 'Active',
            }));
          }
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

    addReward: async (data) => {
      const newRew = {
        id: `rew-${Date.now()}`,
        title: data.title,
        description: data.description || '',
        pointsRequired: parseInt(data.pointsRequired, 10) || 100,
        category: data.category || 'Voucher',
        imageUrl: data.imageUrl || 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=300',
        stock: parseInt(data.stock, 10) || 100,
        status: data.status || 'Active',
      };
      memoryStore.memoryRewards.unshift(newRew);
      if (db.isPgConnected()) {
        try {
          await db.query(
            `INSERT INTO rewards (id, title, description, points_required, category, image_url, stock, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [newRew.id, newRew.title, newRew.description, newRew.pointsRequired, newRew.category, newRew.imageUrl, newRew.stock, newRew.status]
          );
        } catch (e) {
          console.error('PG insert error in addReward:', e);
        }
      }
      return newRew;
    },

    deleteReward: async (id) => {
      memoryStore.memoryRewards = memoryStore.memoryRewards.filter(r => r.id !== id);
      if (db.isPgConnected()) {
        try {
          await db.query('DELETE FROM rewards WHERE id = $1', [id]);
        } catch (e) {
          console.error('PG delete error in deleteReward:', e);
        }
      }
      return true;
    },

    redeemReward: async (employeeId, rewardId) => {
      const empId = employeeId || 'EMP-IT-DEV';
      const getRewardFn = storeRef ? storeRef.getRewardById : store.getRewardById;
      const reward = await getRewardFn(rewardId);
      if (!reward) throw new Error('ไม่พบของรางวัลนี้');

      const couponCode = `WX-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const newRedemption = {
        id: `red-${Date.now()}`,
        employeeId: empId,
        rewardId: rewardId,
        rewardTitle: reward.title,
        rewardImage: reward.imageUrl,
        couponCode: couponCode,
        pointsUsed: reward.pointsRequired,
        status: 'Active',
        createdAt: new Date().toISOString().split('T')[0],
      };
      memoryStore.memoryRedemptions.unshift(newRedemption);

      if (db.isPgConnected()) {
        try {
          await db.query(
            `INSERT INTO redemptions (id, employee_id, reward_id, coupon_code, points_used, status)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [newRedemption.id, empId, rewardId, couponCode, reward.pointsRequired, 'Active']
          );
        } catch (e) {
          console.error('PG insert error in redeemReward:', e);
        }
      }

      const addPointsFn = storeRef ? storeRef.addPointTransaction : store.addPointTransaction;
      await addPointsFn(
        empId,
        `แลกของรางวัล: ${reward.title}`,
        reward.pointsRequired,
        'spend',
        'ของรางวัล (Reward)'
      );

      return newRedemption;
    },

    getUserCoupons: async (employeeId) => {
      const empId = employeeId || 'EMP-IT-DEV';
      return memoryStore.memoryRedemptions.filter(r => r.employeeId === empId);
    },
  };

  return store;
};
