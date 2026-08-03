export const fetchWithTimeout = (url: string, options: RequestInit = {}, timeout = 10000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort('Request timed out'), timeout);

  return fetch(url, {
    ...options,
    signal: controller.signal,
  }).finally(() => clearTimeout(id));
};

/**
 * Historically attached a Supabase JWT bearer token; this fork has no
 * account system, and the API routes this calls (metadata search, Edge
 * TTS) run unauthenticated, so this is now a plain fetch with error
 * handling. Kept under its original name to avoid touching every call
 * site.
 */
export const fetchWithAuth = async (url: string, options: RequestInit) => {
  const response = await fetch(url, options);

  if (!response.ok) {
    const errorData = await response.json();
    console.error('Error:', errorData.error || response.statusText);
    throw new Error(errorData.error || 'Request failed');
  }

  return response;
};
