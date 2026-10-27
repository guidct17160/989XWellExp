import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

/**
 * Automatic Auth Interceptor for Web Admin
 * Injects `Authorization: Bearer <token>` for all internal `/api` calls
 * so that all pages display real PostgreSQL database data seamlessly.
 */
const rawFetch = window.fetch;

// Expired / invalid token: App.jsx shows a "session expired" popup over the page the admin is on (once); pressing OK
// signs out and opens the login page. The flag is reset when App.jsx has cleared the session.
const PUBLIC_AUTH_PATHS = ['/auth/login', '/login', '/set-password', '/forgot-password', '/auth/forgot-password'];
let sessionExpiredHandled = false;
const handleUnauthorized = (url) => {
  try {
    if (sessionExpiredHandled) return;
    if (!localStorage.getItem('wellx989_token')) return;
    if (PUBLIC_AUTH_PATHS.some((p) => url.includes(p))) return;
    sessionExpiredHandled = true;
    window.dispatchEvent(new CustomEvent('wellx989:session-expired', { detail: { reason: 'Your login is no longer valid.' } }));
  } catch (e) {}
};
window.addEventListener('wellx989:session-cleared', () => { sessionExpiredHandled = false; });

window.fetch = async (resource, config = {}) => {
  let url = '';
  let finalConfig = config;
  try {
    url = typeof resource === 'string' ? resource : (resource && resource.url) ? resource.url : '';
    if (url && (url.startsWith('/api') || url.includes('/api/'))) {
      const token = localStorage.getItem('wellx989_token');
      if (token) {
        let headers = config.headers;
        if (!headers) {
          headers = { Authorization: `Bearer ${token}` };
        } else if (headers instanceof Headers) {
          if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
        } else if (Array.isArray(headers)) {
          const hasAuth = headers.some(([k]) => k.toLowerCase() === 'authorization');
          if (!hasAuth) headers = [...headers, ['Authorization', `Bearer ${token}`]];
        } else if (!headers['Authorization'] && !headers['authorization']) {
          headers = { ...headers, Authorization: `Bearer ${token}` };
        }
        finalConfig = { ...config, headers };
      }
    }
  } catch (e) {
    // Pass through to rawFetch on any error
    finalConfig = config;
  }
  const response = await rawFetch(resource, finalConfig);
  if (response.status === 401 && url && (url.startsWith('/api') || url.includes('/api/'))) {
    handleUnauthorized(url);
  }
  return response;
};
window.apiFetch = window.fetch;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
