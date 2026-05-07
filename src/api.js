const DEFAULT_LOCAL_API_PORT = '5000';
const PRODUCTION_API_BASE_URL = 'https://investment-portfolio-dc27.onrender.com';

const getBrowserHostname = () => {
  if (typeof window === 'undefined') return '';
  return String(window.location.hostname || '').trim().toLowerCase();
};

const isPrivateNetworkHostname = (hostname = '') =>
  /^10\./.test(hostname) ||
  /^192\.168\./.test(hostname) ||
  /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);

const isLocalDevHostname = (hostname = getBrowserHostname()) =>
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname === '::1' ||
  isPrivateNetworkHostname(hostname);

const getLocalApiBaseUrl = () => {
  const hostname = getBrowserHostname();
  if (!hostname || hostname === 'localhost') {
    return `http://127.0.0.1:${DEFAULT_LOCAL_API_PORT}`;
  }
  return `http://${hostname}:${DEFAULT_LOCAL_API_PORT}`;
};

const fallbackBaseUrl = isLocalDevHostname()
  ? getLocalApiBaseUrl()
  : PRODUCTION_API_BASE_URL;

const configuredBaseUrl = String(import.meta.env.VITE_API_BASE_URL || '').trim();
const isLocalApiBaseUrl = /localhost:5000/i.test(configuredBaseUrl) || /127\.0\.0\.1:5000/i.test(configuredBaseUrl);
const isBadConfiguredBaseUrl =
  /your-render-service/i.test(configuredBaseUrl) ||
  (!isLocalDevHostname() && isLocalApiBaseUrl);

const rawBaseUrl = configuredBaseUrl && !isBadConfiguredBaseUrl
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
