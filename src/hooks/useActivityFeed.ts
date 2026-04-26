import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { TFunction } from 'i18next';
import { useAuthCore } from './useAuth';
import { useFeedCache } from '@app/FeedCacheContext';
import { getRecentActivity } from '@data/activityRepository';
import type { Friend } from '@services/friendService';
import { getExerciseLabelKey, type ExerciseType } from '@exercises/types';
import { EVENTS_PER_FRIEND, getGradeLetter, type UserId } from '@domain';

export interface ActivityEvent {
    id: string;
    uid: UserId;
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


export function formatRelativeTime(ms: number, t: TFunction<'modals'>): string {
    const diffSec = Math.floor((Date.now() - ms) / 1000);
    if (diffSec < 60) return t('feed.rel_just_now');
    if (diffSec < 3600) return t('feed.rel_minutes', { count: Math.floor(diffSec / 60) });
    if (diffSec < 86400) return t('feed.rel_hours', { count: Math.floor(diffSec / 3600) });
    if (diffSec < 172800) return t('feed.rel_yesterday');
    const d = new Date(ms);
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

function formatDurationCompact(elapsedSec: number | undefined): string {
    const mins = elapsedSec ? Math.floor(elapsedSec / 60) : 0;
    const secs = elapsedSec ? elapsedSec % 60 : 0;
    return mins > 0 ? `${mins}min${secs > 0 ? `${secs}s` : ''}` : `${secs}s`;
}

export function buildEventMessage(event: ActivityEvent, t: TFunction<'modals'>): string {
    const grade = getGradeLetter(event.averageScore);
    const setsInfo = event.numberOfSets && event.numberOfSets > 1
        ? t('feed.msg_sets_suffix', { count: event.numberOfSets })
        : '';

    // ── Multi-exercise workout ──
    if (event.isMultiExercise) {
        const duration = formatDurationCompact(event.elapsedTime);
        const breakdown = event.blockSummaries?.map(b => t('feed.msg_block_pair', { count: b.reps, label: b.label })).join(' + ')
            ?? `${event.reps} ${t('feed.fallback_reps')}`;
        return t('feed.msg_multi_exercise', { duration, breakdown, grade });
    }

    // ── Single-exercise ──
    const exerciseName = event.exerciseType ? t(getExerciseLabelKey(event.exerciseType)) : t('feed.fallback_reps');
    if (event.sessionMode === 'time') {
        const duration = formatDurationCompact(event.elapsedTime);
        return t('feed.msg_time', { count: event.reps, exercise: exerciseName, duration, sets: setsInfo, grade });
    }
    const goalReached = event.reps >= event.goalReps;
    return goalReached
        ? t('feed.msg_goal_reached', { goal: event.goalReps, exercise: exerciseName, sets: setsInfo, grade })
        : t('feed.msg_partial', { count: event.reps, goal: event.goalReps, exercise: exerciseName, sets: setsInfo, grade });
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
            // Sentinel value resolved via t() at the consumer (FriendsFeedPanel).
            setError('feed.error_default');
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
