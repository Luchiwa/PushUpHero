import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuthCore } from './useAuth';
import { useFeedCache } from '@app/FeedCacheContext';
import { getRecentActivity } from '@data/activityRepository';
import type { Friend } from './useFriends';
import type { ExerciseType } from '@exercises/types';
import { getExerciseLabel } from '@exercises/types';

export interface ActivityEvent {
    id: string;
    uid: string;
    displayName: string;
    photoURL?: string;
    photoThumb?: string;
    type: 'session';
    reps: number;
    averageScore: number;
    sessionMode: 'reps' | 'time';
    goalReps: number;
    elapsedTime?: number;
    numberOfSets?: number;
    exerciseType?: ExerciseType;
    isMultiExercise?: boolean;
    blockSummaries?: { label: string; reps: number }[];
    createdAt: number; // Unix ms
}

import { EVENTS_PER_FRIEND, getGradeLetter } from '@domain/constants';

export function formatRelativeTime(ms: number): string {
    const diffSec = Math.floor((Date.now() - ms) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 172800) return 'Yesterday';
    const d = new Date(ms);
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

export function buildEventMessage(event: ActivityEvent): string {
    const grade = getGradeLetter(event.averageScore);

    // ── Multi-exercise workout ──
    if (event.isMultiExercise) {
        const mins = event.elapsedTime ? Math.floor(event.elapsedTime / 60) : 0;
        const secs = event.elapsedTime ? event.elapsedTime % 60 : 0;
        const duration = mins > 0 ? `${mins}min${secs > 0 ? `${secs}s` : ''}` : `${secs}s`;

        // e.g. "3 Push-ups + 5 Squats"
        const breakdown = event.blockSummaries?.map(b => `${b.reps} ${b.label}`).join(' + ') ?? `${event.reps} reps`;

        return `completed a workout in ${duration} — ${breakdown} · Grade ${grade} 🏋️`;
    }

    // ── Single-exercise ──
    const exerciseName = event.exerciseType ? getExerciseLabel(event.exerciseType).toLowerCase() : 'reps';
    const setsInfo = event.numberOfSets && event.numberOfSets > 1 ? ` (${event.numberOfSets} sets)` : '';
    if (event.sessionMode === 'time') {
        const mins = event.elapsedTime ? Math.floor(event.elapsedTime / 60) : 0;
        const secs = event.elapsedTime ? event.elapsedTime % 60 : 0;
        const duration = mins > 0 ? `${mins}min${secs > 0 ? `${secs}s` : ''}` : `${secs}s`;
        return `did ${event.reps} ${exerciseName} in ${duration}${setsInfo} · Grade ${grade}`;
    }
    const goalReached = event.reps >= event.goalReps;
    return goalReached
        ? `hit their goal of ${event.goalReps} ${exerciseName}${setsInfo}! Grade ${grade} 🏆`
        : `did ${event.reps}/${event.goalReps} ${exerciseName}${setsInfo} · Grade ${grade}`;
}

// ── Feed cache ──────────────────────────────────────────────────
// Cache lives in FeedCacheContext (provider mounted in AuthProvider).
// Auto-resets on auth change so a logged-out user can't see the previous one's feed.
const FEED_CACHE_TTL = 120_000; // 2 minutes

export function useActivityFeed(friends: Friend[]) {
    const { user } = useAuthCore();
    const cache = useFeedCache();
    const [feed, setFeed] = useState<ActivityEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Stable identity key: only changes when friend UIDs actually change
    const friendKey = useMemo(
        () => user ? `${user.uid}:${friends.map(f => f.uid).sort().join(',')}` : '',
        [user, friends],
    );

    // Ref to current friends so fetchFeed doesn't re-create on stats-only changes
    const friendsRef = useRef(friends);
    friendsRef.current = friends;

    const fetchFeed = useCallback(async (bypassCache = false) => {
        const currentFriends = friendsRef.current;
        if (!user || currentFriends.length === 0) {
            setFeed([]);
            return;
        }

        // Serve from cache if still fresh and same friend set
        const cached = cache.get();
        if (!bypassCache && cached.key === friendKey && Date.now() - cached.fetchedAt < FEED_CACHE_TTL) {
            // Restore cached data to state (covers remount scenario)
            setFeed(cached.data);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const results = await Promise.all(
                currentFriends.map(async (friend) => {
                    try {
                        const docs = await getRecentActivity(friend.uid, EVENTS_PER_FRIEND);
                        return docs.map((d): ActivityEvent => ({
                            id: d.id,
                            uid: friend.uid,
                            displayName: friend.displayName,
                            photoURL: friend.photoURL,
                            photoThumb: friend.photoThumb,
                            type: 'session',
                            reps: d.reps,
                            averageScore: d.averageScore,
                            sessionMode: d.sessionMode,
                            goalReps: d.goalReps,
                            elapsedTime: d.elapsedTime,
                            numberOfSets: d.numberOfSets,
                            exerciseType: d.exerciseType,
                            isMultiExercise: d.isMultiExercise,
                            blockSummaries: d.blockSummaries,
                            createdAt: d.createdAtMs,
                        }));
                    } catch {
                        // Skip friends whose data is inaccessible (Firestore rules)
                        return [];
                    }
                })
            );

            const merged = results
                .flat()
                .sort((a, b) => b.createdAt - a.createdAt);

            cache.set({ data: merged, fetchedAt: Date.now(), key: friendKey });
            setFeed(merged);
        } catch (err) {
            console.error('[useActivityFeed] fetch error:', err);
            setError('Could not load activity feed.');
        } finally {
            setLoading(false);
        }
    }, [user, friendKey, cache]);

    // Fetch on mount and whenever the friend set changes
    useEffect(() => {
        fetchFeed();
    }, [fetchFeed]);

    // refresh() always bypasses cache
    const refresh = useCallback(() => fetchFeed(true), [fetchFeed]);

    // Enrich cached feed with latest friend photo data (avatars arrive after stats fetch)
    const enrichedFeed = useMemo(() => {
        const friendMap = new Map(friends.map(f => [f.uid, f]));
        return feed.map(event => {
            const friend = friendMap.get(event.uid);
            if (!friend) return event;
            return { ...event, photoURL: friend.photoURL, photoThumb: friend.photoThumb };
        });
    }, [feed, friends]);

    return { feed: enrichedFeed, loading, error, refresh };
}
