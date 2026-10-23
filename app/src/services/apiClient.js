/**
 * MED-6 FIX: apiClient now uses shared getCandidateUrls from apiUtils.js
 * Single source of truth for API URL discovery.
 */
import { getCandidateUrls } from './apiUtils';
import { authService } from './authService';

const getCurrentUserId = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedSession = window.localStorage.getItem('wellx989_session');
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        if (parsed && parsed.loggedIn && parsed.user) {
          return parsed.user.id || parsed.user.code || parsed.user.username;
        }
      }
    }
  } catch (e) {}
  return null;
};

const getCurrentToken = () => {
  try {
    const memToken = authService.getToken();
    if (memToken) return memToken;
  } catch (e) {}
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedSession = window.localStorage.getItem('wellx989_session');
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        if (parsed && parsed.loggedIn) {
          return parsed.token || parsed.accessToken || null;
        }
      }
    }
  } catch (e) {}
  return null;
};

const getCurrentRefreshToken = () => {
  try {
    const memRefresh = authService.getRefreshToken();
    if (memRefresh) return memRefresh;
  } catch (e) {}
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedSession = window.localStorage.getItem('wellx989_session');
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        if (parsed && parsed.loggedIn) {
          return parsed.refreshToken || null;
        }
      }
    }
  } catch (e) {}
  return null;
};

export async function tryFetchApi(endpointPath, rawOptions = {}) {
  // timeoutMs: per-attempt timeout (default 3 s; file uploads pass a longer one)
  const { timeoutMs = 3000, ...options } = rawOptions;
  const candidateUrls = getCandidateUrls();
  const currentToken = getCurrentToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
    ...options.headers,
  };

  for (const baseUrl of candidateUrls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(`${baseUrl}${endpointPath}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Auto-refresh token if expired (401). Auth endpoints that legitimately return 401
      // for bad credentials are excluded; other /auth/* routes (profile, PIN) still refresh.
      const isCredentialEndpoint = /\/(auth\/(login|refresh|logout|verify-pin|forgot-password)|login|forgot-password)$/.test(endpointPath);
      if (res && res.status === 401 && !options._retry && !isCredentialEndpoint) {
        if (getCurrentRefreshToken()) {
          try {
            // authService updates the in-memory token AND the persisted session (works on native + web)
            const newTok = await authService.refreshAccessToken();
            if (newTok) {
              return tryFetchApi(endpointPath, {
                ...options,
                _retry: true,
                timeoutMs,
                headers: {
                  ...options.headers,
                  Authorization: `Bearer ${newTok}`,
                },
              });
            }
          } catch (e) {}
        }
      }

      if (res && res.status !== 404) return res;
    } catch (err) {
      // Try next candidate URL
    }
  }
  return null;
}
