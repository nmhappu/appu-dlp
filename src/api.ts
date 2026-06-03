import { Capacitor } from '@capacitor/core';

// Check if we are running on a native platform (Android/iOS)
export const isNative = Capacitor.isNativePlatform();

// Load the configured backend URL from localStorage
export function getBackendUrl(): string {
  const savedBase = localStorage.getItem('appu_dlp_backend_url');
  if (savedBase) {
    return savedBase;
  }
  
  // Default to empty string for standard relative path resolution on web,
  // or a placeholder that requests setup for native apps
  return '';
}

export function setBackendUrl(url: string) {
  if (url) {
    // Normalize URL (ensure no trailing slash, but must start with http/https)
    let normalized = url.trim().replace(/\/$/, '');
    if (normalized && !/^https?:\/\//i.test(normalized)) {
      normalized = 'http://' + normalized;
    }
    localStorage.setItem('appu_dlp_backend_url', normalized);
  } else {
    localStorage.removeItem('appu_dlp_backend_url');
  }
  // Force reload/refresh components that depend on API calls
  window.dispatchEvent(new Event('appu_dlp_backend_changed'));
}

export function getApiUrl(path: string): string {
  const base = getBackendUrl();
  if (!base) {
    return path;
  }
  return `${base}${path}`;
}
