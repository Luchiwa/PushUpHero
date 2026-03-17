import { useEffect, useCallback } from 'react';
import { doc, getDoc, onSnapshot, collection, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@lib/firebase';
import { useAuth } from './useAuth';
import { mergeLocalDataToCloud } from '@lib/userService';
import type { SessionRecord } from './useSessionHistory';

const LOCAL_STORAGE_REPS_KEY = 'pushup_game_total_reps';
const LOCAL_STORAGE_SESSIONS_KEY = 'pushup-sessions';
const LOCAL_STORAGE_TOTAL_SESSIONS_KEY = 'pushup_game_total_sessions';
const MERGE_LOCK_KEY = 'pushup_merge_in_progress';

/**
 * useSyncCloud
 *
 * Single instance — mounted once inside AppServices.
 * Handles everything related to cloud ↔ local synchronisation:
 *   - On login: merges guest localStorage data into Firestore
 *   - While logged in: realtime listeners for totalReps, sessions, totalSessions
 *   - On logout: seeds state back from localStorage
 */
export function useSyncCloud(
    setTotalLifetimeReps: (reps: number) => void,
    setSessions: (sessions: SessionRecord[]) => void,
    setTotalSessionCount: (count: number) => void,
) {
    const { user } = useAuth();

    // ─── Merge guest data into Firestore on first login ───────────────────────
    const mergeLocalToCloud = useCallback(async (uid: string) => {
        if (localStorage.getItem(MERGE_LOCK_KEY) === 'true') return;

        const localReps = parseInt(localStorage.getItem(LOCAL_STORAGE_REPS_KEY) ?? '0', 10) || 0;
        let localSessions: SessionRecord[] = [];
        try {
            const raw = localStorage.getItem(LOCAL_STORAGE_SESSIONS_KEY);
            if (raw) localSessions = JSON.parse(raw);
        } catch { /* malformed data — skip */ }

        // Claim the lock and clear local storage before any async work
        localStorage.setItem(MERGE_LOCK_KEY, 'true');
        localStorage.removeItem(LOCAL_STORAGE_REPS_KEY);
        localStorage.removeItem(LOCAL_STORAGE_SESSIONS_KEY);
        localStorage.removeItem(LOCAL_STORAGE_TOTAL_SESSIONS_KEY);

        if (localReps > 0 || localSessions.length > 0) {
            try {
                const userDoc = await getDoc(doc(db, 'users', uid));
                const cloudReps = userDoc.exists() ? (userDoc.data().totalReps || 0) : 0;
                const cloudSessions = userDoc.exists() ? (userDoc.data().totalSessions || 0) : 0;

                await mergeLocalDataToCloud({ uid, localReps, localSessions, cloudReps, cloudSessions });
            } catch (e) {
                console.error('[useSyncCloud] Merge failed:', e);
            }
        }

        localStorage.removeItem(MERGE_LOCK_KEY);
    }, []);

    // ─── Realtime listeners (or localStorage fallback for guests) ────────────
    useEffect(() => {
        if (!user) {
            // Guest: seed state from localStorage
            const reps = parseInt(localStorage.getItem(LOCAL_STORAGE_REPS_KEY) ?? '0', 10) || 0;
            setTotalLifetimeReps(reps);
            try {
                const raw = localStorage.getItem(LOCAL_STORAGE_SESSIONS_KEY);
                setSessions(raw ? JSON.parse(raw) : []);
            } catch { setSessions([]); }
            const count = parseInt(localStorage.getItem(LOCAL_STORAGE_TOTAL_SESSIONS_KEY) ?? '0', 10) || 0;
            setTotalSessionCount(count);
            return;
        }

        mergeLocalToCloud(user.uid);

        const userRef = doc(db, 'users', user.uid);

        // User profile: totalReps + totalSessions
        const unsubProfile = onSnapshot(userRef, (snap) => {
            if (!snap.exists()) return;
            const data = snap.data();
            if (data.totalReps !== undefined) setTotalLifetimeReps(data.totalReps);
            if (data.totalSessions !== undefined) setTotalSessionCount(data.totalSessions);
        });

        // Sessions subcollection (last 5 — enough for the history panel)
        const sessionsQuery = query(
            collection(db, 'users', user.uid, 'sessions'),
            orderBy('date', 'desc'),
            limit(5),
        );
        const unsubSessions = onSnapshot(sessionsQuery, (snap) => {
            setSessions(snap.docs.map(d => d.data() as SessionRecord));
        });

        return () => { unsubProfile(); unsubSessions(); };
    }, [user, mergeLocalToCloud, setTotalLifetimeReps, setSessions, setTotalSessionCount]);

    return {};
}
