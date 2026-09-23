/**
 * MED-6 FIX: Shared API URL discovery utility.
 * Used by both apiClient.js and authService.js to avoid duplicate logic.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Get candidate API base URLs in priority order.
 * Tries LAN IP, browser hostname, localhost, and Android emulator bridge.
 * @returns {string[]} Array of candidate URLs
 */
export function getCandidateUrls() {
  const urls = [];

  // 1. Try extracting LAN IP from Expo manifest (Physical device on Wi-Fi)
  try {
    const hostUri =
      Constants?.expoConfig?.hostUri ||
      Constants?.manifest2?.extra?.expoGo?.debuggerHost ||
      Constants?.manifest?.debuggerHost;
    if (hostUri) {
      const lanIp = hostUri.split(':')[0];
      if (lanIp && lanIp !== 'localhost' && lanIp !== '127.0.0.1') {
        urls.push(`http://${lanIp}:5000/api/v1`);
        urls.push(`http://${lanIp}:5000/api`);
      }
    }
  } catch (e) {}

  // 2. If running in Web browser or Expo web
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    const host = window.location.hostname;
    const isHttps = window.location.protocol === 'https:';
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      urls.push(`http://${host}:5000/api/v1`);
      urls.push(`http://${host}:5000/api`);
      if (isHttps) {
        urls.push(`https://${host}:5000/api/v1`);
        urls.push(`https://${host}:5000/api`);
      }
    }
  }

  // 3. Localhost & 127.0.0.1 (For iOS Simulator)
  urls.push('http://localhost:5000/api/v1');
  urls.push('http://localhost:5000/api');
  urls.push('http://127.0.0.1:5000/api/v1');
  urls.push('http://127.0.0.1:5000/api');

  // 4. Android Emulator bridge (10.0.2.2)
  if (Platform.OS === 'android') {
    urls.push('http://10.0.2.2:5000/api/v1');
    urls.push('http://10.0.2.2:5000/api');
  }

  return [...new Set(urls)];
}

/**
 * Attempt to fetch an API endpoint across all candidate URLs.
 * Returns the first successful response (non-404).
 * @param {string} endpointPath - API path (e.g., '/auth/login')
 * @param {object} options - fetch options
 * @param {number} timeoutMs - timeout per attempt (default 3000ms)
 * @returns {Response|null}
 */
export async function tryFetchWithCandidates(endpointPath, options = {}, timeoutMs = 3000) {
  const candidateUrls = getCandidateUrls();

  for (const baseUrl of candidateUrls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(`${baseUrl}${endpointPath}`, {
        ...options,
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
