export type StatusBlockState = 'success' | 'failure' | 'mixed' | 'idle';

export interface StatusBlockDetail {
  success: number;
  failure: number;
  requests: number;
  rate: number;
  requestsPerMinute: number;
  latencyMs: number;
  latencyCount: number;
  avgLatencyMs: number;
  lastLatencyMs: number;
  startTime: number;
  endTime: number;
}

export interface StatusBarData {
  blocks: StatusBlockState[];
  blockDetails: StatusBlockDetail[];
  successRate: number;
  totalSuccess: number;
  totalFailure: number;
  windowStats: RecentRequestWindowStats;
}

export interface RecentRequestBucket {
  time?: string;
  success: number;
  failed: number;
  latencyMs: number;
  latencyCount: number;
  avgLatencyMs: number;
  lastLatencyMs: number;
}

export interface RecentRequestSummary {
  windowSeconds: number;
  bucketSeconds: number;
  windowRequests: number;
  instantRpm: number;
  averageRpm: number;
  instantLatencyMs: number;
  averageLatencyMs: number;
  latestLatencyMs: number;
}

export interface RecentRequestWindowStats {
  success: number;
  failure: number;
  requests: number;
  successRate: number;
  instantRpm: number;
  averageRpm: number;
  instantLatencyMs: number;
  averageLatencyMs: number;
  latestLatencyMs: number;
  windowMinutes: number;
}

export interface RecentRequestUsageEntry {
  success: number;
  failed: number;
  recentRequests: RecentRequestBucket[];
  summary?: RecentRequestSummary;
}

export type ApiKeyUsageResponse = Record<
  string,
  Record<
    string,
    {
      success?: unknown;
      failed?: unknown;
      recent_requests?: unknown;
      recentRequests?: unknown;
      summary?: unknown;
    }
  >
>;

export const RECENT_REQUEST_BLOCK_COUNT = 20;
export const RECENT_REQUEST_BLOCK_DURATION_SECONDS = 10 * 60;
export const RECENT_REQUEST_BLOCK_DURATION_MS = RECENT_REQUEST_BLOCK_DURATION_SECONDS * 1000;
export const RECENT_REQUEST_WINDOW_MINUTES =
  (RECENT_REQUEST_BLOCK_COUNT * RECENT_REQUEST_BLOCK_DURATION_SECONDS) / 60;

const toFiniteNumber = (value: unknown): number => {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

export function normalizeUsageTotal(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return 0;
    }
    const numberValue = Number(trimmed);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }
  return 0;
}

export function buildRecentRequestCompositeKey(baseUrl: unknown, apiKey: unknown): string {
  const normalizedBaseUrl = String(baseUrl ?? '').trim();
  const normalizedApiKey = String(apiKey ?? '').trim();
  return `${normalizedBaseUrl}|${normalizedApiKey}`;
}

export function normalizeRecentRequestAuthIndex(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toString();
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return null;
}

export function normalizeRecentRequestBuckets(input: unknown): RecentRequestBucket[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.slice(-RECENT_REQUEST_BLOCK_COUNT).map((item) => {
    const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const time = typeof record.time === 'string' ? record.time : undefined;

    const latencyMs = toFiniteNumber(record.latency_ms ?? record.latencyMs);
    const latencyCount = toFiniteNumber(record.latency_count ?? record.latencyCount);
    const avgLatencyMs = toFiniteNumber(record.avg_latency_ms ?? record.avgLatencyMs);

    return {
      ...(time ? { time } : {}),
      success: toFiniteNumber(record.success),
      failed: toFiniteNumber(record.failed),
      latencyMs,
      latencyCount,
      avgLatencyMs: avgLatencyMs || (latencyCount > 0 ? latencyMs / latencyCount : 0),
      lastLatencyMs: toFiniteNumber(record.last_latency_ms ?? record.lastLatencyMs),
    };
  });
}

export function normalizeRecentRequestSummary(input: unknown): RecentRequestSummary | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return undefined;
  }
  const record = input as Record<string, unknown>;
  return {
    windowSeconds: toFiniteNumber(record.window_seconds ?? record.windowSeconds),
    bucketSeconds: toFiniteNumber(record.bucket_seconds ?? record.bucketSeconds),
    windowRequests: toFiniteNumber(record.window_requests ?? record.windowRequests),
    instantRpm: toFiniteNumber(record.instant_rpm ?? record.instantRpm),
    averageRpm: toFiniteNumber(record.average_rpm ?? record.averageRpm),
    instantLatencyMs: toFiniteNumber(record.instant_latency_ms ?? record.instantLatencyMs),
    averageLatencyMs: toFiniteNumber(record.average_latency_ms ?? record.averageLatencyMs),
    latestLatencyMs: toFiniteNumber(record.latest_latency_ms ?? record.latestLatencyMs),
  };
}

export function normalizeRecentRequestUsageEntry(input: unknown): RecentRequestUsageEntry {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      success: 0,
      failed: 0,
      recentRequests: [],
    };
  }

  const record = input as Record<string, unknown>;

  return {
    success: normalizeUsageTotal(record.success),
    failed: normalizeUsageTotal(record.failed),
    recentRequests: normalizeRecentRequestBuckets(record.recent_requests ?? record.recentRequests),
    summary: normalizeRecentRequestSummary(record.summary),
  };
}

export function mergeRecentRequestBucketGroups(
  groups: RecentRequestBucket[][]
): RecentRequestBucket[] {
  const normalizedGroups = groups
    .map((group) => normalizeRecentRequestBuckets(group))
    .filter((group) => group.length > 0);

  if (normalizedGroups.length === 0) {
    return [];
  }

  const mergedLength = Math.min(
    RECENT_REQUEST_BLOCK_COUNT,
    Math.max(...normalizedGroups.map((group) => group.length))
  );
  const merged: RecentRequestBucket[] = Array.from({ length: mergedLength }, () => ({
    success: 0,
    failed: 0,
    latencyMs: 0,
    latencyCount: 0,
    avgLatencyMs: 0,
    lastLatencyMs: 0,
  }));

  normalizedGroups.forEach((group) => {
    const tail = group.slice(-mergedLength);
    const offset = mergedLength - tail.length;

    tail.forEach((bucket, index) => {
      const target = merged[offset + index];
      target.success += bucket.success;
      target.failed += bucket.failed;
      target.latencyMs += bucket.latencyMs;
      target.latencyCount += bucket.latencyCount;
      target.avgLatencyMs =
        target.latencyCount > 0 ? target.latencyMs / target.latencyCount : 0;
      if (bucket.lastLatencyMs > 0) {
        target.lastLatencyMs = bucket.lastLatencyMs;
      }
      if (!target.time && bucket.time) {
        target.time = bucket.time;
      }
    });
  });

  return merged;
}

export function sumRecentRequests(
  buckets: RecentRequestBucket[]
): { success: number; failure: number; latencyMs: number; latencyCount: number } {
  return normalizeRecentRequestBuckets(buckets).reduce(
    (total, bucket) => ({
      success: total.success + bucket.success,
      failure: total.failure + bucket.failed,
      latencyMs: total.latencyMs + bucket.latencyMs,
      latencyCount: total.latencyCount + bucket.latencyCount,
    }),
    { success: 0, failure: 0, latencyMs: 0, latencyCount: 0 }
  );
}

export function getRecentRequestWindowStats(buckets: RecentRequestBucket[]): RecentRequestWindowStats {
  const normalizedBuckets = normalizeRecentRequestBuckets(buckets);
  const paddedBuckets = [
    ...Array.from({ length: Math.max(0, RECENT_REQUEST_BLOCK_COUNT - normalizedBuckets.length) }, () => ({
      success: 0,
      failed: 0,
      latencyMs: 0,
      latencyCount: 0,
      avgLatencyMs: 0,
      lastLatencyMs: 0,
    })),
    ...normalizedBuckets.slice(-RECENT_REQUEST_BLOCK_COUNT),
  ];

  const totals = sumRecentRequests(paddedBuckets);
  const requests = totals.success + totals.failure;
  const newest = paddedBuckets[paddedBuckets.length - 1];
  const newestRequests = newest ? newest.success + newest.failed : 0;
  const latestLatencyMs = paddedBuckets.reduce(
    (latest, bucket) => (bucket.lastLatencyMs > 0 ? bucket.lastLatencyMs : latest),
    0
  );

  return {
    success: totals.success,
    failure: totals.failure,
    requests,
    successRate: requests > 0 ? (totals.success / requests) * 100 : 100,
    instantRpm: newestRequests / (RECENT_REQUEST_BLOCK_DURATION_SECONDS / 60),
    averageRpm: requests / RECENT_REQUEST_WINDOW_MINUTES,
    instantLatencyMs:
      newest && newest.latencyCount > 0 ? newest.latencyMs / newest.latencyCount : 0,
    averageLatencyMs:
      totals.latencyCount > 0 ? totals.latencyMs / totals.latencyCount : 0,
    latestLatencyMs,
    windowMinutes: RECENT_REQUEST_WINDOW_MINUTES,
  };
}

export function formatExactNumber(value: number, locale?: string, maximumFractionDigits = 0): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat(locale || undefined, {
    maximumFractionDigits,
    minimumFractionDigits: 0,
    useGrouping: true,
  }).format(safeValue);
}

export function formatLatencyMs(value: number, locale?: string): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '--';
  }
  return `${formatExactNumber(value, locale, value < 10 ? 1 : 0)} ms`;
}

export function formatRequestsPerMinute(value: number, locale?: string, unit = 'rpm'): string {
  return `${formatExactNumber(value, locale, value < 10 && value > 0 ? 2 : 1)} ${unit}`;
}

export function statusBarDataFromRecentRequests(buckets: RecentRequestBucket[]): StatusBarData {
  const normalizedBuckets = normalizeRecentRequestBuckets(buckets);
  const emptyBucketCount = Math.max(0, RECENT_REQUEST_BLOCK_COUNT - normalizedBuckets.length);
  const blockStats = [
    ...Array.from({ length: emptyBucketCount }, () => ({
      success: 0,
      failed: 0,
      latencyMs: 0,
      latencyCount: 0,
      avgLatencyMs: 0,
      lastLatencyMs: 0,
    })),
    ...normalizedBuckets.slice(-RECENT_REQUEST_BLOCK_COUNT),
  ];

  const now = Date.now();
  const windowStart = now - RECENT_REQUEST_BLOCK_COUNT * RECENT_REQUEST_BLOCK_DURATION_MS;

  const blocks: StatusBlockState[] = [];
  const blockDetails: StatusBarData['blockDetails'] = [];
  let totalSuccess = 0;
  let totalFailure = 0;

  blockStats.forEach((bucket, index) => {
    const success = bucket.success;
    const failure = bucket.failed;
    const total = success + failure;
    const avgLatencyMs =
      bucket.latencyCount > 0 ? bucket.latencyMs / bucket.latencyCount : bucket.avgLatencyMs;

    totalSuccess += success;
    totalFailure += failure;

    if (total === 0) {
      blocks.push('idle');
    } else if (failure === 0) {
      blocks.push('success');
    } else if (success === 0) {
      blocks.push('failure');
    } else {
      blocks.push('mixed');
    }

    const blockStartTime = windowStart + index * RECENT_REQUEST_BLOCK_DURATION_MS;
    blockDetails.push({
      success,
      failure,
      requests: total,
      rate: total > 0 ? success / total : -1,
      requestsPerMinute: total / (RECENT_REQUEST_BLOCK_DURATION_SECONDS / 60),
      latencyMs: bucket.latencyMs,
      latencyCount: bucket.latencyCount,
      avgLatencyMs,
      lastLatencyMs: bucket.lastLatencyMs,
      startTime: blockStartTime,
      endTime: blockStartTime + RECENT_REQUEST_BLOCK_DURATION_MS,
    });
  });

  const total = totalSuccess + totalFailure;

  return {
    blocks,
    blockDetails,
    successRate: total > 0 ? (totalSuccess / total) * 100 : 100,
    totalSuccess,
    totalFailure,
    windowStats: getRecentRequestWindowStats(normalizedBuckets),
  };
}
