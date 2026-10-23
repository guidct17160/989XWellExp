import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { MENU_PATHS, matchMenu } from '../routes';

// A "detail page" lives under its menu's path (/departments/IT, /missions/new, /rewards/categories/CAT-002),
// so it can be bookmarked, refreshed and navigated with the browser back / forward buttons.
// `menu` is the sidebar menu key of the page that calls this hook (see MENU_PATHS in routes.js).
export default function useDetailRoute(menu) {
  const location = useLocation();
  const navigate = useNavigate();
  const basePath = MENU_PATHS[menu];

  const matched = matchMenu(location.pathname);
  const detailId = matched && matched.menu === menu ? matched.detail : null;

  const open = useCallback((id) => {
    navigate(`${basePath}/${encodeURIComponent(String(id))}`, { state: { detail: true } });
  }, [navigate, basePath]);

  // swap the id in the address bar without adding a history entry (e.g. the item got a new code)
  const replace = useCallback((id) => {
    navigate(`${basePath}/${encodeURIComponent(String(id))}`, { replace: true, state: { detail: true } });
  }, [navigate, basePath]);

  const close = useCallback(() => {
    // we pushed the detail entry ourselves, so going back removes it from the history
    if (location.state && location.state.detail) {
      navigate(-1);
      return;
    }
    navigate(basePath, { replace: true });
  }, [navigate, basePath, location.state]);

  return { detailId, open, replace, close };
}
