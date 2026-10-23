// Web admin URLs. Each sidebar menu key has one readable path; detail pages hang under it
// (e.g. /departments/IT, /missions/new, /rewards/categories/CAT-002).
export const MENU_PATHS = {
  dashboard: '/dashboard',
  admin: '/admins',
  'audit-logs': '/audit-logs',
  department: '/departments',
  'all-employee': '/employees',
  points: '/points',
  attendance: '/attendance',
  'work-locations': '/attendance/work-locations',
  'leave-policy': '/leave-policies',
  mission: '/missions',
  reward: '/rewards',
  'reward-categories': '/rewards/categories',
};

export const HOME_PATH = MENU_PATHS.dashboard;

// Old bookmarks used /?tab=<menu>&id=<id>; these tab values no longer exist as menus
const LEGACY_TABS = {
  approvals: 'leave-policy',
  position: 'all-employee',
  section: 'all-employee',
  kpi: 'all-employee',
  corrections: 'attendance',
};

// Longest base first, so /rewards/categories is not mistaken for /rewards
const BY_LENGTH = Object.entries(MENU_PATHS).sort((a, b) => b[1].length - a[1].length);

// '/rewards/categories/CAT-002' -> { menu: 'reward-categories', detail: 'CAT-002' }; unknown path -> null
export const matchMenu = (pathname) => {
  const clean = String(pathname || '').replace(/\/+$/, '') || '/';
  for (const [menu, base] of BY_LENGTH) {
    if (clean === base) return { menu, detail: null };
    if (clean.startsWith(`${base}/`)) {
      const rest = clean.slice(base.length + 1).split('/')[0];
      let detail = rest;
      try { detail = decodeURIComponent(rest); } catch (e) { /* keep the raw segment */ }
      return { menu, detail: detail || null };
    }
  }
  return null;
};

// Convert an old /?tab=...&id=... address into the new path (null when there is no tab)
export const legacyTabPath = (search) => {
  try {
    const params = new URLSearchParams(search);
    const tab = params.get('tab');
    if (!tab) return null;
    const menu = LEGACY_TABS[tab] || tab;
    const base = MENU_PATHS[menu];
    if (!base) return HOME_PATH;
    const id = params.get('id');
    return id && !LEGACY_TABS[tab] ? `${base}/${encodeURIComponent(id)}` : base;
  } catch (e) {
    return null;
  }
};
