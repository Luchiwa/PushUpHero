import { useCallback } from 'react';
import { useAuth } from './useAuth';
import { saveSession } from '@lib/userService';
import { MAX_LOCAL_SESSIONS } from '@lib/constants';
import type { SetRecord } from '@exercises/types';

const STORAGE_KEY = 'pushup-sessions';
const STORAGE_TOTAL_KEY = 'pushup_game_total_sessions';

export interface SessionRecord {
    id: string;
    date: number;        // Unix timestamp (ms)
    reps: number;        // total reps across all sets (aggregate)
    averageScore: number;
    goalReps: number;
    sessionMode?: 'reps' | 'time';
    elapsedTime?: number;          // seconds — total duration

    // ── Multi-set fields ──
    numberOfSets?: number;         // configured sets count (1 = legacy single-set)
    restDuration?: number;         // configured rest between sets (seconds)
    sets?: SetRecord[];            // per-set breakdown
    totalDuration?: number;        // total workout duration including rest (seconds)
}

function saveLocalSessions(sessions: SessionRecord[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch { /* localStorage not available */ }
}

export function useSessionHistory() {
    const { user, dbUser, totalLifetimeReps, addGuestReps, sessions, setSessions, totalSessionCount, setTotalSessionCount } = useAuth();

    /**
     * Save a completed session.
     * - Logged in: one atomic writeBatch (session + profile stats + activity feed)
     * - Guest: localStorage only
     */
    const addSession = useCallback(async (entry: Omit<SessionRecord, 'id' | 'date'>) => {
        const newSession: SessionRecord = {
            ...entry,
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            date: Date.now(),
        };

        // Firestore rejects undefined values — remove optional fields if absent
        if (newSession.elapsedTime === undefined) delete newSession.elapsedTime;
        if (newSession.sessionMode === undefined) delete newSession.sessionMode;
        if (newSession.numberOfSets === undefined) delete newSession.numberOfSets;
        if (newSession.restDuration === undefined) delete newSession.restDuration;
        if (newSession.sets === undefined) delete newSession.sets;
        if (newSession.totalDuration === undefined) delete newSession.totalDuration;

        if (user) {
            await saveSession({
                uid: user.uid,
                session: newSession,
                currentTotalReps: totalLifetimeReps,
                dbUser,
            });
        } else {
            const updated = [newSession, ...sessions].slice(0, MAX_LOCAL_SESSIONS);
            setSessions(updated);
            saveLocalSessions(updated);
            const newCount = totalSessionCount + 1;
            setTotalSessionCount(newCount);
            localStorage.setItem(STORAGE_TOTAL_KEY, newCount.toString());
            addGuestReps(newSession.reps);
        }
    }, [user, dbUser, totalLifetimeReps, sessions, totalSessionCount, addGuestReps, setSessions, setTotalSessionCount]);

    return { sessions, addSession, totalSessionCount };
}