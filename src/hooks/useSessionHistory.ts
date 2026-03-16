import { useCallback, useState } from 'react';
import { useAuth } from './useAuth';
import { useSyncCloud } from './useSyncCloud';
import { saveSession } from '@lib/userService';

const STORAGE_KEY = 'pushup-sessions';
const STORAGE_TOTAL_KEY = 'pushup_game_total_sessions';
const MAX_LOCAL_SESSIONS = 5;

export interface SessionRecord {
    id: string;
    date: number;        // Unix timestamp (ms)
    reps: number;
    averageScore: number;
    goalReps: number;
    sessionMode?: 'reps' | 'time'; // 'reps' for backward compatibility
    elapsedTime?: number;          // seconds for time-based sessions
}

function loadLocalSessions(): SessionRecord[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as SessionRecord[]) : [];
    } catch {
        return [];
    }
}

function saveLocalSessions(sessions: SessionRecord[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch { /* localStorage not available */ }
}

export function useSessionHistory() {
    const { user, dbUser, totalLifetimeReps, addGuestReps } = useAuth();

    const [sessions, setSessions] = useState<SessionRecord[]>(() => loadLocalSessions());
    const [totalSessionCount, setTotalSessionCount] = useState<number>(() => {
        const raw = localStorage.getItem(STORAGE_TOTAL_KEY);
        return raw ? parseInt(raw, 10) : 0;
    });

    // Sync sessions + totalSessionCount from Firestore (or localStorage for guests).
    // totalReps is handled by useLevelSystem's own useSyncCloud instance.
    useSyncCloud(undefined, setSessions, setTotalSessionCount);

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
    }, [user, dbUser, totalLifetimeReps, sessions, totalSessionCount, addGuestReps]);

    return { sessions, addSession, totalSessionCount };
}