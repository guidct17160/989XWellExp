// Central API configuration for WellX989 Web Admin
export const API_BASE = (import.meta.env.VITE_API_BASE !== undefined && import.meta.env.VITE_API_BASE !== '')
  ? import.meta.env.VITE_API_BASE
  : '/api';

export const getAuthToken = () => {
  try {
    return localStorage.getItem('wellx989_token') || '';
  } catch (e) {
    return '';
  }
};

export const getAuthHeaders = (extraHeaders = {}) => {
  const token = getAuthToken();
  const headers = { ...extraHeaders };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};
