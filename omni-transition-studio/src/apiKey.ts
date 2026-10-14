const STORAGE_KEY = 'omni-studio:gemini-key';

export function getApiKey(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setApiKey(key: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, key.trim());
  } catch {
    // sessionStorage unavailable — silently ignore
  }
}

export function clearApiKey(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // sessionStorage unavailable — silently ignore
  }
}

export function hasApiKey(): boolean {
  const key = getApiKey();
  return key !== null && key.length > 0;
}

export function isValidKeyFormat(key: string): boolean {
  const trimmed = key.trim();
  // Gemini API key formats vary and don't share a fixed prefix; only
  // enforce a minimum length to catch obvious typos. The server / Google
  // API will reject invalid keys with a clear error.
  return trimmed.length >= 20;
}
