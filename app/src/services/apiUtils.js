/**
 * MED-6 FIX: Shared API URL discovery utility.
 * Used by both apiClient.js and authService.js to avoid duplicate logic.
 */
import { Platform, NativeModules } from 'react-native';

/**
 * Get candidate API base URLs in priority order.
 * Tries LAN IP, browser hostname, localhost, and Android emulator bridge.
 * @returns {string[]} Array of candidate URLs
 */
export function getCandidateUrls() {
  const urls = [];

  // 1. Try extracting the computer's LAN IP from the Metro host (Physical device on Wi-Fi).
  // Expo's hostUri (e.g. "172.16.0.22:8081") is the reliable source; on the new React Native
  // architecture NativeModules.SourceCode.scriptURL can be missing, so it is only the fallback.
  const lanIps = [];
  try {
    const Constants = require('expo-constants').default;
    const hostUri =
      (Constants.expoConfig && Constants.expoConfig.hostUri) ||
      (Constants.expoGoConfig && Constants.expoGoConfig.debuggerHost) ||
      '';
    if (hostUri) lanIps.push(String(hostUri).split(':')[0]);
  } catch (e) {}
  try {
    const scriptURL = NativeModules && NativeModules.SourceCode && NativeModules.SourceCode.scriptURL;
    const match = typeof scriptURL === 'string' ? scriptURL.match(/^https?:\/\/([^/:]+)/) : null;
    if (match) lanIps.push(match[1]);
  } catch (e) {}
  lanIps.forEach((lanIp) => {
    if (lanIp && lanIp !== 'localhost' && lanIp !== '127.0.0.1') {
      urls.push(`http://${lanIp}:5000/api/v1`);
      urls.push(`http://${lanIp}:5000/api`);
    }
  });

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
// Which URLs the last request tried and why each failed (shown in the login error to help diagnose)
let lastAttempts = [];
export const describeLastAttempts = () => lastAttempts.slice(0, 3).join('\n');

export async function tryFetchWithCandidates(endpointPath, options = {}, timeoutMs = 3000) {
  const candidateUrls = getCandidateUrls();
  lastAttempts = [];

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
      lastAttempts.push(`${baseUrl} → HTTP ${res ? res.status : '?'}`);
    } catch (err) {
      // Try next candidate URL
      lastAttempts.push(`${baseUrl} → ${err && err.name === 'AbortError' ? 'timeout' : (err && err.message) || 'error'}`);
    }
  }
  return null;
}
