export async function api<T = any>(
  url: string,
  opts?: { method?: string; body?: unknown }
): Promise<T> {
  const res = await fetch(url, {
    method: opts?.method || 'GET',
    headers: opts?.body ? { 'content-type': 'application/json' } : undefined,
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data as T;
}
