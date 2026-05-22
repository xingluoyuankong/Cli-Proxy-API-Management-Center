import { DEFAULT_API_PORT, MANAGEMENT_API_PREFIX } from './constants';

const REDUNDANT_API_SUFFIX_PATTERNS = [
  /\/?management\.html\/?$/i,
  /\/?v0\/management\/config(?:\.yaml)?\/?$/i,
  /\/?v0\/management\/?$/i,
  /\/?config(?:\.yaml)?\/?$/i
];

export const normalizeApiBase = (input: string): string => {
  let base = (input || '').trim();
  if (!base) return '';

  for (const pattern of REDUNDANT_API_SUFFIX_PATTERNS) {
    base = base.replace(pattern, '');
  }

  base = base.replace(/\/+$/i, '');
  if (!/^https?:\/\//i.test(base)) {
    base = `http://${base}`;
  }
  return base;
};

export const computeApiUrl = (base: string): string => {
  const normalized = normalizeApiBase(base);
  if (!normalized) return '';
  return `${normalized}${MANAGEMENT_API_PREFIX}`;
};

export const detectApiBaseFromLocation = (): string => {
  try {
    const { protocol, hostname, port } = window.location;
    const normalizedPort = port ? `:${port}` : '';
    return normalizeApiBase(`${protocol}//${hostname}${normalizedPort}`);
  } catch (error) {
    console.warn('Failed to detect api base from location, fallback to default', error);
    return normalizeApiBase(`http://localhost:${DEFAULT_API_PORT}`);
  }
};

export const isLocalhost = (hostname: string): boolean => {
  const value = (hostname || '').toLowerCase();
  return value === 'localhost' || value === '127.0.0.1' || value === '[::1]';
};
