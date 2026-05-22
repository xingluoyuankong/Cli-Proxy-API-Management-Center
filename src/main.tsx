import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/global.scss';
import { INLINE_LOGO_JPEG } from '@/assets/logoInline';
import App from './App.tsx';

const AUTH_CACHE_RESET_FLAG = 'cli-proxy-auth-reset-version';
const AUTH_CACHE_RESET_VERSION = '2026-05-05-reset-1';
const AUTH_CACHE_KEYS = ['cli-proxy-auth', 'isLoggedIn', 'apiBase', 'apiUrl', 'managementKey'] as const;

const clearAuthCacheOnce = (): void => {
  try {
    if (localStorage.getItem(AUTH_CACHE_RESET_FLAG) === AUTH_CACHE_RESET_VERSION) {
      return;
    }

    AUTH_CACHE_KEYS.forEach((key) => localStorage.removeItem(key));
    localStorage.setItem(AUTH_CACHE_RESET_FLAG, AUTH_CACHE_RESET_VERSION);
  } catch (error) {
    console.warn('Failed to reset auth cache:', error);
  }
};

clearAuthCacheOnce();

document.title = 'CLI Proxy API Management Center';
document.documentElement.setAttribute('translate', 'no');
document.documentElement.classList.add('notranslate');

const faviconEl = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
if (faviconEl) {
  faviconEl.href = INLINE_LOGO_JPEG;
  faviconEl.type = 'image/jpeg';
} else {
  const newFavicon = document.createElement('link');
  newFavicon.rel = 'icon';
  newFavicon.type = 'image/jpeg';
  newFavicon.href = INLINE_LOGO_JPEG;
  document.head.appendChild(newFavicon);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
