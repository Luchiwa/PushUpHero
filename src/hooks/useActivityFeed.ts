import { useState, useEffect, useCallback } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import type { Timestamp } from 'firebase/firestore';
import { db } from '@lib/firebase';
import { useAuth } from './useAuth';
import type { Friend } from './useFriends';

export interface ActivityEvent {
    id: string;
    uid: string;
    displayName: string;
    photoURL?: string;
    type: 'session';
    reps: number;
    averageScore: number;
    sessionMode: 'reps' | 'time';
    goalReps: number;
    elapsedTime?: number;
    numberOfSets?: number;
    createdAt: number; // Unix ms
}

import { EVENTS_PER_FRIEND, getGradeLetter } from '@lib/constants';

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
    const setsInfo = event.numberOfSets && event.numberOfSets > 1 ? ` (${event.numberOfSets} sets)` : '';
    if (event.sessionMode === 'time') {
        const mins = event.elapsedTime ? Math.floor(event.elapsedTime / 60) : 0;
        const secs = event.elapsedTime ? event.elapsedTime % 60 : 0;
        const duration = mins > 0 ? `${mins}min${secs > 0 ? `${secs}s` : ''}` : `${secs}s`;
        return `did ${event.reps} push-ups in ${duration}${setsInfo} · Grade ${grade}`;
    }
    const goalReached = event.reps >= event.goalReps;
    return goalReached
        ? `hit their goal of ${event.goalReps} push-ups${setsInfo}! Grade ${grade} 🏆`
        : `did ${event.reps}/${event.goalReps} push-ups${setsInfo} · Grade ${grade}`;
}

export function useActivityFeed(friends: Friend[]) {
    const { user } = useAuth();
    const [feed, setFeed] = useState<ActivityEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchFeed = useCallback(async () => {
        if (!user || friends.length === 0) {
            setFeed([]);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const results = await Promise.all(
                friends.map(async (friend) => {
                    try {
                        const ref = collection(db, 'users', friend.uid, 'activityFeed');
                        const q = query(ref, orderBy('createdAt', 'desc'), limit(EVENTS_PER_FRIEND));
                        const snap = await getDocs(q);

                        return snap.docs.map((d): ActivityEvent => {
                            const data = d.data();
                            const ts = data.createdAt as Timestamp | null;
                            return {
                                id: d.id,
                                uid: friend.uid,
                                displayName: friend.displayName,
                                photoURL: friend.photoURL,
                                type: 'session',
                                reps: data.reps ?? 0,
                                averageScore: data.averageScore ?? 0,
                                sessionMode: data.sessionMode ?? 'reps',
                                goalReps: data.goalReps ?? 0,
                                elapsedTime: data.elapsedTime,
                                numberOfSets: data.numberOfSets,
                                createdAt: ts ? ts.toMillis() : Date.now(),
                            };
                        });
                    } catch {
                        // Skip friends whose data is inaccessible (Firestore rules)
                        return [];
                    }
                })
            );

            const merged = results
                .flat()
                .sort((a, b) => b.createdAt - a.createdAt);

            setFeed(merged);
        } catch (err) {
            console.error('[useActivityFeed] fetch error:', err);
            setError('Could not load activity feed.');
        } finally {
            setLoading(false);
        }
    }, [user, friends]);

    // Fetch on mount and whenever the friends list changes
    useEffect(() => {
        fetchFeed();
    }, [fetchFeed]);

    return { feed, loading, error, refresh: fetchFeed };
}
