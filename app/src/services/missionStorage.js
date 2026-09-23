import { tryFetchApi } from './apiClient';
import { pointsStorage } from './pointsStorage';

// missionStorage.js — 100% Real Backend Connected Mission State Service (No Mockups)

let globalMissions = [];
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = window.localStorage.getItem('wellx_user_missions_cache');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        globalMissions = parsed;
      }
    }
  }
} catch (e) {}
const listeners = new Set();

const getIconColor = (icon, category) => {
  switch (icon) {
    case 'water':
    case 'water-outline':
      return { iconColor: '#0EA5E9', bgColor: '#E0F2FE', iconName: 'water' };
    case 'footsteps':
    case 'footsteps-outline':
      return { iconColor: '#10B981', bgColor: '#D1FAE5', iconName: 'footsteps' };
    case 'alarm':
    case 'time':
      return { iconColor: '#F59E0B', bgColor: '#FEF3C7', iconName: 'alarm' };
    case 'fitness':
      return { iconColor: '#EF4444', bgColor: '#FEE2E2', iconName: 'fitness' };
    case 'shield-checkmark':
      return { iconColor: '#8B5CF6', bgColor: '#EDE9FE', iconName: 'shield-checkmark' };
    default:
      return category === 'weekly'
        ? { iconColor: '#8B5CF6', bgColor: '#EDE9FE', iconName: 'star' }
        : { iconColor: '#F5A623', bgColor: '#FFF8E6', iconName: 'trophy' };
  }
};

const formatBackendMission = (m) => {
  const target = Number(m.targetValue || m.targetSteps || m.total || 1);
  const cur = Number(m.currentValue || m.progress || 0);
  const pts = Number(m.rewardPoints || m.points || m.reward || 10);
  const isDone = !!m.isCompleted || cur >= target;
  const isClaimed = !!m.isClaimed || m.status === 'completed';

  let status = 'pending';
  if (isClaimed) {
    status = 'completed';
  } else if (isDone) {
    status = 'ready_to_claim';
  }

  const category = (m.category || 'daily').toLowerCase();
  const iconInfo = getIconColor(m.icon, category);

  return {
    id: String(m.id),
    title: m.title,
    subtitle: m.description || m.desc || 'ภารกิจสุขภาพพนักงาน',
    description: m.description || m.desc || 'ภารกิจสุขภาพพนักงาน',
    descTitle: m.title,
    descText1: m.description || 'ทำกิจกรรมตามเงื่อนไขที่กำหนดเพื่อรับคะแนนสะสม',
    descText2: 'สะสมคะแนนแลกของรางวัลใน WellX Store',
    link1: null,
    link2: null,
    expiry: 'สิ้นสุดวันนี้ 23:59 น.',
    points: pts,
    reward: pts,
    rewardPoints: pts,
    progress: cur,
    currentValue: cur,
    total: target,
    targetValue: target,
    targetSteps: target,
    status: status,
    isCompleted: isDone,
    isClaimed: isClaimed,
    category: category,
    icon: iconInfo.iconName,
    iconColor: iconInfo.iconColor,
    bgColor: iconInfo.bgColor,
    step1: 'ทำกิจกรรมตามเป้าหมายที่กำหนดให้สำเร็จ',
    step2: 'ระบบจะอัปเดตความคืบหน้าอัตโนมัติ',
    step3: 'กดปุ่ม "รับรางวัล" เพื่อรับพอยท์สะสม',
    question: null,
    updatedAt: m.updatedAt || Date.now(),
  };
};

export const missionStorage = {
  getMissions() {
    return [...globalMissions];
  },

  getMissionById(id) {
    return globalMissions.find((m) => m.id === String(id)) || null;
  },

  async fetchMissions() {
    try {
      const res = await tryFetchApi('/missions');
      if (res && res.ok) {
        const json = await res.json();
        if (json && json.success && Array.isArray(json.missions)) {
          const remoteMissions = json.missions.map(formatBackendMission);

          // Merge with any local in-progress/completed missions
          let localCache = {};
          try {
            if (typeof window !== 'undefined' && window.localStorage) {
              const saved = window.localStorage.getItem('wellx_user_missions_cache');
              if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                  parsed.forEach((p) => { localCache[p.id] = p; });
                }
              }
            }
          } catch (e) {}

          globalMissions = remoteMissions.map((rm) => {
            const local = localCache[rm.id] || globalMissions.find((gm) => gm.id === rm.id);
            if (local) {
              // If local is completed or ready to claim or has higher progress, preserve it!
              if (local.status === 'completed' || local.status === 'ready_to_claim' || local.progress > rm.progress) {
                return {
                  ...rm,
                  progress: local.progress,
                  currentValue: local.progress,
                  status: local.status,
                  isCompleted: local.isCompleted,
                  isClaimed: local.isClaimed,
                };
              }
            }
            return rm;
          });

          listeners.forEach((fn) => fn(globalMissions));
          return globalMissions;
        }
      }
    } catch (e) {
      console.error('Failed to fetch real missions from API', e);
    }
    return globalMissions;
  },

  async claimMission(missionId) {
    try {
      const res = await tryFetchApi(`/missions/${missionId}/claim`, {
        method: 'POST',
      });
      if (res && res.ok) {
        const data = await res.json();
        if (data && data.success) {
          // Update local mission status
          globalMissions = globalMissions.map((m) => {
            if (m.id === String(missionId)) {
              return {
                ...m,
                status: 'completed',
                isClaimed: true,
                isCompleted: true,
                progress: m.total,
                updatedAt: Date.now(),
              };
            }
            return m;
          });
          listeners.forEach((fn) => fn(globalMissions));

          try {
            if (typeof window !== 'undefined' && window.localStorage) {
              window.localStorage.setItem('wellx_user_missions_cache', JSON.stringify(globalMissions));
            }
          } catch (e) {}

          // Refresh points
          if (pointsStorage && typeof pointsStorage.syncWithBackend === 'function') {
            pointsStorage.syncWithBackend();
          }

          return data;
        }
      }
    } catch (e) {
      console.error('Error claiming mission on backend:', e);
    }

    // Fallback local update
    globalMissions = globalMissions.map((m) => {
      if (m.id === String(missionId)) {
        return {
          ...m,
          status: 'completed',
          isClaimed: true,
          isCompleted: true,
          progress: m.total,
          updatedAt: Date.now(),
        };
      }
      return m;
    });
    listeners.forEach((fn) => fn(globalMissions));
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('wellx_user_missions_cache', JSON.stringify(globalMissions));
      }
    } catch (e) {}
    return { success: true };
  },

  async updateMission(id, updates) {
    const cleanId = String(id);
    let targetMission = null;

    globalMissions = globalMissions.map((m) => {
      if (m.id === cleanId) {
        const curProgress = updates.progress !== undefined ? Number(updates.progress) : m.progress;
        const isDone = curProgress >= m.total || updates.status === 'ready_to_claim' || updates.status === 'completed' || updates.isCompleted;
        const status = updates.status || (isDone ? 'ready_to_claim' : 'pending');

        targetMission = {
          ...m,
          ...updates,
          progress: curProgress,
          currentValue: curProgress,
          status,
          isCompleted: isDone,
          updatedAt: Date.now(),
        };
        return targetMission;
      }
      return m;
    });

    listeners.forEach((fn) => fn(globalMissions));

    // 1. Sync progress to backend
    try {
      await tryFetchApi(`/missions/${cleanId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          progress: targetMission?.progress !== undefined ? targetMission.progress : (updates.progress || 1),
          isCompleted: targetMission?.status === 'ready_to_claim' || targetMission?.status === 'completed' || targetMission?.isCompleted,
        }),
      });
    } catch (e) {
      console.error('Failed to sync mission progress to backend', e);
    }

    // 2. Persist to localStorage cache
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('wellx_user_missions_cache', JSON.stringify(globalMissions));
      }
    } catch (e) {}

    // Only auto-claim if marked completed AND not already claimed
    if ((updates.status === 'completed' || updates.isClaimed) && !globalMissions.find(m => m.id === cleanId)?.isClaimed) {
      await this.claimMission(cleanId);
    }
    return [...globalMissions];
  },

  async syncSteps(stepsCount) {
    try {
      const res = await tryFetchApi('/missions/sync-steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps: Number(stepsCount) }),
      });
      if (res && res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.missions)) {
          globalMissions = data.missions.map(formatBackendMission);
          listeners.forEach((fn) => fn(globalMissions));
        }
      }
    } catch (e) {
      console.error('Failed to sync steps with backend', e);
    }
  },

  subscribe(listener) {
    listeners.add(listener);
    listener(globalMissions);
    return () => listeners.delete(listener);
  },
};

// Initial fetch on app start
missionStorage.fetchMissions();
