import axios from 'axios';

const TOKEN_KEY = 'pk_food_token';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const err = error as { response?: { status?: number } };
    const publicPaths = ['/login', '/verify-email', '/forgot-password', '/reset-password'];
    const onPublicPage = publicPaths.some(p => window.location.pathname.startsWith(p));
    if (err.response?.status === 401 && !onPublicPage) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export const clearToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};
