/**
 * FeedCacheContext — Session-scoped cache for the friends activity feed.
 *
 * The cache lives in a ref inside the provider, so it survives unmount /
 * remount of consumers (e.g. ProfileModal close → reopen) without paying
 * a refetch. Auto-resets when the authenticated user changes — this is
 * the property the previous module-level `let feedCache` could not give:
 * a singleton outliving auth boundaries is a cross-user data leak.
 */
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useAuthCore } from '@hooks/useAuth';
import type { ActivityEvent } from '@hooks/useActivityFeed';

export interface FeedCache {
    data: ActivityEvent[];
    fetchedAt: number;
    /** Composite key: user.uid + sorted friend uids. Cache misses if key drifts. */
    key: string;
}

interface FeedCacheContextValue {
    get(): FeedCache;
    set(next: FeedCache): void;
}

const emptyCache = (): FeedCache => ({ data: [], fetchedAt: 0, key: '' });

const FeedCacheContext = createContext<FeedCacheContextValue | null>(null);

export function FeedCacheProvider({ children }: { children: ReactNode }) {
    const cacheRef = useRef<FeedCache>(emptyCache());
    const { user } = useAuthCore();

    // Reset whenever the logged-in user changes so the next user can't
    // observe the previous one's feed (logout, account swap on shared device).
    useEffect(() => {
        cacheRef.current = emptyCache();
    }, [user?.uid]);

    const value = useMemo<FeedCacheContextValue>(() => ({
        get: () => cacheRef.current,
        set: (next) => { cacheRef.current = next; },
    }), []);

    return (
        <FeedCacheContext.Provider value={value}>
            {children}
        </FeedCacheContext.Provider>
    );
}

export function useFeedCache(): FeedCacheContextValue {
    const ctx = useContext(FeedCacheContext);
    if (!ctx) throw new Error('useFeedCache must be used within FeedCacheProvider');
    return ctx;
}
