import { API_BASE } from './apiBase.js';
import { getApiKey } from './apiKey.js';

export class MissingApiKeyError extends Error {
  constructor() {
    super('Missing Gemini API key');
    this.name = 'MissingApiKeyError';
  }
}

/**
 * Wrapper fetch that auto-attaches the X-Gemini-Key header.
 * Throws MissingApiKeyError if no key is set.
 * Path argument should be relative (e.g. 'api/foo' or '/api/foo');
 * the API_BASE prefix is prepended automatically.
 */
export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const key = getApiKey();
  if (!key) throw new MissingApiKeyError();

  const normalized = path.replace(/^\/+/, '');
  const url = `${API_BASE}${normalized}`;

  const headers = new Headers(init?.headers);
  headers.set('X-Gemini-Key', key);

  const res = await fetch(url, { ...init, headers });

  if (res.status === 401) {
    const body = await res.clone().json().catch(() => ({}));
    if (body?.code === 'MISSING_API_KEY') {
      throw new MissingApiKeyError();
    }
  }
  return res;
}
