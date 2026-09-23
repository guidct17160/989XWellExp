import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

/**
 * MED-5 FIX: Replaced global window.fetch monkey-patch with proper wrapper.
 * Use `window.apiFetch` or import from a utility for authenticated API calls.
 * This avoids conflicts with third-party libraries and browser extensions.
 */
window.apiFetch = async (resource, config = {}) => {
  try {
    const token = localStorage.getItem('wellx989_token');
    if (token) {
      const existingHeaders = config.headers || {};
      config = {
        ...config,
        headers: {
          ...existingHeaders,
          Authorization: `Bearer ${token}`,
        },
      };
    }
  } catch (e) {
    // Ignore localStorage access issues
  }
  return fetch(resource, config);
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
