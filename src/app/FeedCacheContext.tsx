/**
 * FeedCacheContext — Session-scoped cache for the friends activity feed.
 *
 * The cache lives in a ref inside the provider (mounted in AuthProvider.tsx),
 * so it survives unmount/remount of consumers (e.g. ProfileModal close →
 * reopen) without paying a refetch. The provider also auto-resets the ref
 * when the authenticated user changes — this is the property the previous
 * module-level `let feedCache` could not give: a singleton that outlives
 * auth boundaries is a cross-user data leak.
 */
import { createContext, useContext } from 'react';
import type { ActivityEvent } from '@hooks/useActivityFeed';

export interface FeedCache {
    data: ActivityEvent[];
    fetchedAt: number;
    /** Composite key: user.uid + sorted friend uids. Cache misses if key drifts. */
    key: string;
}

export interface FeedCacheContextValue {
    get(): FeedCache;
    set(next: FeedCache): void;
}

export const FeedCacheContext = createContext<FeedCacheContextValue | null>(null);

export function useFeedCache(): FeedCacheContextValue {
    const ctx = useContext(FeedCacheContext);
    if (!ctx) throw new Error('useFeedCache must be used within FeedCacheContext.Provider');
    return ctx;
}

export const emptyFeedCache = (): FeedCache => ({ data: [], fetchedAt: 0, key: '' });
