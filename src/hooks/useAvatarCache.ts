/**
 * useAvatarCache — Caches avatar images locally using the Cache API
 * so they don't re-download on every page load.
 *
 * Returns a stable `getCachedUrl` that resolves a Firebase Storage URL
 * to a local blob: URL served from cache.
 */

const CACHE_NAME = 'avatar-cache-v1';

/** Extract a stable cache key from a Firebase Storage URL (strip token). */
function cacheKey(url: string): string {
    try {
        const u = new URL(url);
        u.searchParams.delete('token');
        return u.toString();
    } catch {
        return url;
    }
}

/**
 * Get a cached blob URL for the given image URL.
 * If the image is already in cache, returns a blob URL instantly.
 * Otherwise, fetches it, stores it in cache, and returns a blob URL.
 */
export async function getCachedAvatarUrl(originalUrl: string): Promise<string> {
    if (!originalUrl) return '';

    try {
        const cache = await caches.open(CACHE_NAME);
        const key = cacheKey(originalUrl);

        // Try cache first
        const cached = await cache.match(key);
        if (cached) {
            const blob = await cached.blob();
            return URL.createObjectURL(blob);
        }

        // Fetch and cache
        const response = await fetch(originalUrl);
        if (!response.ok) return originalUrl; // fallback to original

        // Store a clone in cache (keyed without token)
        await cache.put(key, response.clone());

        const blob = await response.blob();
        return URL.createObjectURL(blob);
    } catch {
        // Cache API unavailable or network error — fallback to original URL
        return originalUrl;
    }
}

/**
 * Bust the cache for a specific URL (e.g. after avatar upload).
 */
export async function invalidateAvatarCache(originalUrl: string): Promise<void> {
    try {
        const cache = await caches.open(CACHE_NAME);
        await cache.delete(cacheKey(originalUrl));
    } catch {
        // ignore
    }
}
