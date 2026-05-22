/**
 * Generic hook for quota data fetching and management.
 */

import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { AuthFileItem } from '@/types';
import { useQuotaStore } from '@/stores';
import { getStatusFromError } from '@/utils/quota';
import type { QuotaConfig } from './quotaConfigs';

type QuotaScope = 'page' | 'all';

interface LoadOptions {
  maxConcurrency?: number;
  onProgress?: (completed: number, total: number) => void;
}

type QuotaUpdater<T> = T | ((prev: T) => T);

type QuotaSetter<T> = (updater: QuotaUpdater<T>) => void;

interface LoadQuotaResult<TData> {
  name: string;
  status: 'success' | 'error';
  data?: TData;
  error?: string;
  errorStatus?: number;
}

export function useQuotaLoader<TState, TData>(config: QuotaConfig<TState, TData>) {
  const { t } = useTranslation();
  const quota = useQuotaStore(config.storeSelector);
  const setQuota = useQuotaStore((state) => state[config.storeSetter]) as QuotaSetter<
    Record<string, TState>
  >;

  const loadingRef = useRef(false);
  const requestIdRef = useRef(0);

  const loadQuota = useCallback(
    async (
      targets: AuthFileItem[],
      scope: QuotaScope,
      setLoading: (loading: boolean, scope?: QuotaScope | null) => void,
      options: LoadOptions = {}
    ) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      const requestId = ++requestIdRef.current;
      setLoading(true, scope);

      const { maxConcurrency = 12, onProgress } = options;

      try {
        if (targets.length === 0) return;

        setQuota((prev) => {
          const nextState = { ...prev };
          targets.forEach((file) => {
            nextState[file.name] = config.buildLoadingState();
          });
          return nextState;
        });

        // 并发控制：分批处理
        const results: LoadQuotaResult<TData>[] = [];
        let completed = 0;

        // 过滤掉禁用的凭证
        const enabledTargets = targets.filter((file) => !file.disabled);

        for (let i = 0; i < enabledTargets.length; i += maxConcurrency) {
          if (requestId !== requestIdRef.current) return;

          const batch = enabledTargets.slice(i, i + maxConcurrency);
          const batchResults = await Promise.all(
            batch.map(async (file): Promise<LoadQuotaResult<TData>> => {
              try {
                const data = await config.fetchQuota(file, t);
                completed++;
                onProgress?.(completed, enabledTargets.length);
                return { name: file.name, status: 'success', data };
              } catch (err: unknown) {
                completed++;
                onProgress?.(completed, enabledTargets.length);
                const message = err instanceof Error ? err.message : t('common.unknown_error');
                const errorStatus = getStatusFromError(err);
                return { name: file.name, status: 'error', error: message, errorStatus };
              }
            })
          );
          results.push(...batchResults);
        }

        if (requestId !== requestIdRef.current) return;

        setQuota((prev) => {
          const nextState = { ...prev };
          results.forEach((result) => {
            if (result.status === 'success') {
              nextState[result.name] = config.buildSuccessState(result.data as TData);
            } else {
              nextState[result.name] = config.buildErrorState(
                result.error || t('common.unknown_error'),
                result.errorStatus
              );
            }
          });
          return nextState;
        });
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          loadingRef.current = false;
        }
      }
    },
    [config, setQuota, t]
  );

  return { quota, loadQuota };
}
