const isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const fallbackBaseUrl = isLocalhost
  ? 'http://127.0.0.1:5000'
  : 'https://investment-portfolio-dc27.onrender.com';

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || fallbackBaseUrl;

export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '');

export const apiUrl = (path = '') => {
  if (!path.startsWith('/')) {
    return `${API_BASE_URL}/${path}`;
  }
  return `${API_BASE_URL}${path}`;
};

export const getAuthToken = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') || '';
};

export const withAuthHeaders = (headers = {}) => {
  const token = getAuthToken();
  if (!token) return { ...headers };

  return {
    ...headers,
    Authorization: `Bearer ${token}`,
  };
};
