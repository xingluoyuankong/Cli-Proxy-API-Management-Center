import { apiClient } from './client';

const RUNTIME_CACHE_TIMEOUT_MS = 60 * 1000;

export interface RuntimeCacheClearResponse {
  success?: boolean;
  cleared?: string[];
  [key: string]: unknown;
}

export const runtimeCacheApi = {
  clear: () =>
    apiClient.post<RuntimeCacheClearResponse>(
      '/runtime-cache/clear',
      {},
      { timeout: RUNTIME_CACHE_TIMEOUT_MS }
    ),
};
