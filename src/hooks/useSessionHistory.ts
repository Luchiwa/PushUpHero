import { useCallback, useState } from 'react';
import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import { useSyncCloud } from './useSyncCloud';

const STORAGE_KEY = 'pushup-sessions';
const STORAGE_TOTAL_KEY = 'pushup_game_total_sessions';
const MAX_SESSIONS = 5;

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
    const { user } = useAuth();

    // Internal state
    const [sessions, setSessions] = useState<SessionRecord[]>(() => loadLocalSessions());
    const [totalSessionCount, setTotalSessionCount] = useState<number>(() => {
        const raw = localStorage.getItem(STORAGE_TOTAL_KEY);
        return raw ? parseInt(raw, 10) : 0;
    });

    // Cloud listener — also resets to local sessions on logout
    useSyncCloud(
        undefined,
        setSessions,
        setTotalSessionCount
    );

    const getSessions = useCallback((): SessionRecord[] => sessions, [sessions]);

    const addSession = useCallback(async (entry: Omit<SessionRecord, 'id' | 'date'>) => {
        const newSession: SessionRecord = {
            ...entry,
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            date: Date.now(),
        };

        if (user) {
            // Write to Cloud directly (Realtime listener updates local state)
            const sessionRef = doc(collection(db, 'users', user.uid, 'sessions'), newSession.id);
            await setDoc(sessionRef, newSession);
            // Increment totalSessions counter on user doc
            const { updateDoc, increment } = await import('firebase/firestore');
            await updateDoc(doc(db, 'users', user.uid), { totalSessions: increment(1) });
        } else {
            // Write to Local State
            const updated = [newSession, ...sessions].slice(0, MAX_SESSIONS);
            setSessions(updated);
            saveLocalSessions(updated);
            // Track total count locally
            const newCount = totalSessionCount + 1;
            setTotalSessionCount(newCount);
            localStorage.setItem(STORAGE_TOTAL_KEY, newCount.toString());
        }
    }, [user, sessions, totalSessionCount]);

    return { getSessions, addSession, totalSessionCount };
}