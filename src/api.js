const isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const fallbackBaseUrl = isLocalhost
  ? 'http://127.0.0.1:5000'
  : 'https://investment-portfolio-dc27.onrender.com';

const configuredBaseUrl = String(import.meta.env.VITE_API_BASE_URL || '').trim();
const isBadProductionBaseUrl =
  !isLocalhost &&
  (/your-render-service/i.test(configuredBaseUrl) ||
    /localhost:5000/i.test(configuredBaseUrl) ||
    /127\.0\.0\.1:5000/i.test(configuredBaseUrl));

const rawBaseUrl = configuredBaseUrl && !isBadProductionBaseUrl
  ? configuredBaseUrl
  : fallbackBaseUrl;

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
