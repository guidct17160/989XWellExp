// The services persist state through the web `window.localStorage` API. On native builds that API
// does not exist, so nothing survived an app restart. This installs a localStorage-compatible shim
// backed by AsyncStorage: everything is loaded into memory once at startup (so reads stay
// synchronous, like the services expect) and writes go through to AsyncStorage.
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// Auth tokens must not sit in plain AsyncStorage. The session blob is split on write: the tokens go
// to the OS keychain/keystore (SecureStore), the rest (profile, timestamps) stays in AsyncStorage.
const SESSION_KEY = 'wellx989_session';
const TOKENS_KEY = 'wellx989_session_tokens';
const TOKEN_FIELDS = ['token', 'accessToken', 'refreshToken'];

const splitSession = (raw) => {
  try {
    const parsed = JSON.parse(raw);
    const tokens = {};
    TOKEN_FIELDS.forEach((f) => {
      if (parsed[f]) tokens[f] = parsed[f];
      delete parsed[f];
    });
    return { rest: JSON.stringify(parsed), tokens: JSON.stringify(tokens) };
  } catch (e) {
    return { rest: raw, tokens: null };
  }
};

const mergeSession = (rest, tokens) => {
  try {
    return JSON.stringify({ ...JSON.parse(rest), ...JSON.parse(tokens) });
  } catch (e) {
    return rest;
  }
};

export async function installNativeStorage() {
  if (Platform.OS === 'web') return;

  const cache = new Map();
  try {
    const keys = await AsyncStorage.getAllKeys();
    const pairs = keys.length ? await AsyncStorage.multiGet(keys) : [];
    pairs.forEach(([k, v]) => {
      if (v !== null) cache.set(k, v);
    });
    // Tokens come back from SecureStore. A legacy session that still holds tokens inside
    // AsyncStorage is migrated by the next saveSession().
    if (cache.has(SESSION_KEY)) {
      const tokens = await SecureStore.getItemAsync(TOKENS_KEY).catch(() => null);
      if (tokens) cache.set(SESSION_KEY, mergeSession(cache.get(SESSION_KEY), tokens));
    }
  } catch (e) {
    console.log('Error loading persisted storage', e);
  }

  const persist = (op) => op.catch((e) => console.log('Error writing persisted storage', e));

  const shim = {
    getItem: (k) => (cache.has(k) ? cache.get(k) : null),
    setItem: (k, v) => {
      const value = String(v);
      cache.set(k, value);
      if (k === SESSION_KEY) {
        const { rest, tokens } = splitSession(value);
        persist(AsyncStorage.setItem(k, rest));
        persist(tokens ? SecureStore.setItemAsync(TOKENS_KEY, tokens) : SecureStore.deleteItemAsync(TOKENS_KEY));
        return;
      }
      persist(AsyncStorage.setItem(k, value));
    },
    removeItem: (k) => {
      cache.delete(k);
      if (k === SESSION_KEY) persist(SecureStore.deleteItemAsync(TOKENS_KEY));
      persist(AsyncStorage.removeItem(k));
    },
    clear: () => {
      const keys = Array.from(cache.keys());
      cache.clear();
      persist(SecureStore.deleteItemAsync(TOKENS_KEY));
      persist(AsyncStorage.multiRemove(keys));
    },
    key: (i) => Array.from(cache.keys())[i] ?? null,
    get length() {
      return cache.size;
    },
  };

  const root = typeof window !== 'undefined' ? window : globalThis;
  root.localStorage = shim;
  if (root !== globalThis) globalThis.localStorage = shim;
  if (typeof window === 'undefined') globalThis.window = globalThis;
}
