import { useCallback, useState, useEffect } from 'react';
import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import { useSyncCloud } from './useSyncCloud';

const STORAGE_KEY = 'pushup-sessions';
const MAX_SESSIONS = 5;

export interface SessionRecord {
    id: string;
    date: number;        // Unix timestamp (ms)
    reps: number;
    averageScore: number;
    goalReps: number;
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
    } catch { }
}

export function useSessionHistory() {
    const { user } = useAuth();

    // Internal state
    const [sessions, setSessions] = useState<SessionRecord[]>(() => loadLocalSessions());

    // Cloud listener
    useSyncCloud(
        undefined,
        setSessions
    );

    // Refresh local state when entering guest mode (e.g. on logout)
    useEffect(() => {
        if (!user) {
            setSessions(loadLocalSessions());
        }
    }, [user]);

    const getSessions = useCallback((): SessionRecord[] => sessions, [sessions]);

    const addSession = useCallback(async (entry: Omit<SessionRecord, 'id' | 'date'>) => {
        const newSession: SessionRecord = {
            ...entry,
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            date: Date.now(),
        };

        if (user) {
            // Write to Cloud directly  (Realtime listener updates local state)
            const sessionRef = doc(collection(db, 'users', user.uid, 'sessions'), newSession.id);
            await setDoc(sessionRef, newSession);
        } else {
            // Write to Local State
            const updated = [newSession, ...sessions].slice(0, MAX_SESSIONS);
            setSessions(updated);
            saveLocalSessions(updated);
        }
    }, [user, sessions]);

    return { getSessions, addSession };
}
