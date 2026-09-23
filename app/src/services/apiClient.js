/**
 * MED-6 FIX: apiClient now uses shared getCandidateUrls from apiUtils.js
 * Single source of truth for API URL discovery.
 */
import { getCandidateUrls } from './apiUtils';

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

export async function tryFetchApi(endpointPath, options = {}) {
  const candidateUrls = getCandidateUrls();
  const currentUserId = getCurrentUserId();
  const currentToken = getCurrentToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
    ...options.headers,
  };

  for (const baseUrl of candidateUrls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`${baseUrl}${endpointPath}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (res && res.status !== 404) return res;
    } catch (err) {
      // Try next candidate URL
    }
  }
  return null;
}
