import { tryFetchApi } from './apiClient';

// pointsStorage.js — Shared singleton for point transactions & subscriptions

const getUserId = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const session = window.localStorage.getItem('wellx989_session');
      if (session) {
        const parsed = JSON.parse(session);
        if (parsed && parsed.loggedIn && parsed.user) {
          return parsed.user.id || parsed.user.code || parsed.user.username;
        }
      }
    }
  } catch (e) {}
  return 'default';
};

const getStorageKey = (prefix) => `${prefix}_${getUserId()}`;

const defaultTransactions = [];

let globalTransactions = [...defaultTransactions];
let globalUserPoints = 0;
const listeners = new Set();

const loadLocalState = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(getStorageKey('points_state'));
      if (saved) {
        const parsed = JSON.parse(saved);
        globalTransactions = Array.isArray(parsed.transactions) ? parsed.transactions : [];
        globalUserPoints = typeof parsed.userPoints === 'number' ? parsed.userPoints : 0;
        return;
      }
    }
  } catch (e) {}
  globalTransactions = [];
  globalUserPoints = 0;
};
loadLocalState();

const saveState = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(getStorageKey('points_state'), JSON.stringify({
        transactions: globalTransactions,
        userPoints: globalUserPoints,
      }));
    }
  } catch (e) {}
};

const syncWithBackend = async () => {
  try {
    const res = await tryFetchApi('/points/history');
    if (res && res.ok) {
      const data = await res.json();
      if (data && data.success) {
        // Backend returns { currentPoints, history } — map to local field names
        const backendTxns = Array.isArray(data.transactions) ? data.transactions : (Array.isArray(data.history) ? data.history : []);
        if (backendTxns.length > 0) {
          const mergedTxns = [...backendTxns];
          (globalTransactions || []).forEach((localItem) => {
            if (localItem && !mergedTxns.some((b) => b.id === localItem.id)) {
              mergedTxns.push(localItem);
            }
          });
          globalTransactions = mergedTxns;
        }
        const backendPoints = typeof data.userPoints === 'number' ? data.userPoints : (typeof data.currentPoints === 'number' ? data.currentPoints : null);
        if (backendPoints !== null && backendPoints >= 0) {
          globalUserPoints = backendPoints;
        }
        saveState();
        listeners.forEach((fn) => fn({ userPoints: globalUserPoints, transactions: globalTransactions }));
      }
    }
  } catch (e) {
    console.log('Failed to sync points from API', e);
  }
};
syncWithBackend();

const formatThaiDate = (d) => {
  const thaiMonths = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
  ];
  const day = d.getDate();
  const month = thaiMonths[d.getMonth()];
  const year = d.getFullYear() + 543;
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year} • ${hours}:${mins} น.`;
};

export const pointsStorage = {
  getTransactions: () => {
    return [...globalTransactions];
  },

  getUserPoints: () => {
    return globalUserPoints;
  },

  addTransaction: (title, points, type = 'in', category = 'ภารกิจ (Mission)') => {
    const now = new Date();
    const formattedDate = formatThaiDate(now);

    const newEntry = {
      id: `t_m_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      title: type === 'in' ? `ภารกิจ: ${title}` : `แลก ${title}`,
      points: points,
      type: type,
      date: formattedDate,
      category: category,
    };

    if (type === 'in') {
      globalUserPoints += points;
    } else {
      globalUserPoints -= points;
    }

    globalTransactions = [newEntry, ...globalTransactions];

    if (type === 'out') {
      try {
        tryFetchApi(`/rewards/${globalTransactions[0]?.rewardId || 'unknown'}/redeem`, { method: 'POST' });
      } catch (e) {}
    }

    // Notify all subscribers
    listeners.forEach((fn) => {
      try {
        fn({ userPoints: globalUserPoints, transactions: globalTransactions });
      } catch (e) {
        console.error('Error in pointsStorage listener:', e);
      }
    });

    return { transactions: globalTransactions, userPoints: globalUserPoints };
  },

  async clearAndSync() {
    loadLocalState();
    saveState();
    listeners.forEach((fn) => {
      try {
        fn({ userPoints: globalUserPoints, transactions: globalTransactions });
      } catch (e) {}
    });
    await syncWithBackend();
  },

  subscribe: (listener) => {
    if (typeof listener === 'function') {
      listeners.add(listener);
    }
    return () => {
      listeners.delete(listener);
    };
  },

  syncWithBackend,
};
