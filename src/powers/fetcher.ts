export type CatalogFetcher = (url: string, timeoutMs: number) => Promise<string>;

export const CATALOG_URL = 'https://enriquecordero.github.io/sdd-studio/powers/catalog.json';
export const FETCH_TIMEOUT_MS = 10_000;

export const httpFetcher: CatalogFetcher = async (url, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (e) {
    if (controller.signal.aborted) throw new Error(`tiempo agotado (${Math.max(1, Math.round(timeoutMs / 1000))} s)`);
    throw e instanceof Error ? e : new Error(String(e));
  } finally {
    clearTimeout(timer);
  }
};
