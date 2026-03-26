import { useEffect, useCallback } from 'react';
import { doc, getDoc, updateDoc, onSnapshot, collection, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@lib/firebase';
import { useAuthCore } from './useAuth';
import { mergeLocalDataToCloud } from '@lib/userService';
import { totalXpForLevel } from '@lib/xpSystem';
import type { SessionRecord } from './useSessionHistory';
import type { ExerciseXpMap } from './useLevelSystem';
import { getGuestStatsSnapshot, clearGuestStats } from '@lib/guestStatsStore';

const LOCAL_STORAGE_XP_KEY = 'pushup_hero_total_xp';
const LOCAL_STORAGE_EXERCISE_XP_KEY = 'pushup_hero_exercise_xp';
const LOCAL_STORAGE_SESSIONS_KEY = 'pushup-sessions';
const LOCAL_STORAGE_TOTAL_SESSIONS_KEY = 'pushup_game_total_sessions';
const MERGE_LOCK_KEY = 'pushup_merge_in_progress';

/**
 * useSyncCloud
 *
 * Single instance — mounted once inside AppServices.
 * Handles everything related to cloud ↔ local synchronisation:
 *   - On login: merges guest localStorage data into Firestore
 *   - While logged in: realtime listeners for totalXp, exerciseXp, sessions, totalSessions
 *   - On logout: seeds state back from localStorage
 */
export function useSyncCloud(
    setTotalXp: (xp: number) => void,
    setExerciseXp: (map: ExerciseXpMap) => void,
    setSessions: (sessions: SessionRecord[]) => void,
    setTotalSessionCount: (count: number) => void,
) {
    const { user } = useAuthCore();

    // ─── Merge guest data into Firestore on first login ───────────────────────
    const mergeLocalToCloud = useCallback(async (uid: string) => {
        if (localStorage.getItem(MERGE_LOCK_KEY) === 'true') return;

        const localXp = parseInt(localStorage.getItem(LOCAL_STORAGE_XP_KEY) ?? '0', 10) || 0;
        let localExerciseXp: Partial<Record<string, number>> = {};
        try {
            const raw = localStorage.getItem(LOCAL_STORAGE_EXERCISE_XP_KEY);
            if (raw) localExerciseXp = JSON.parse(raw);
        } catch { /* skip */ }
        let localSessions: SessionRecord[] = [];
        try {
            const raw = localStorage.getItem(LOCAL_STORAGE_SESSIONS_KEY);
            if (raw) localSessions = JSON.parse(raw);
        } catch { /* malformed data — skip */ }

        // Claim the lock and clear local storage before any async work
        localStorage.setItem(MERGE_LOCK_KEY, 'true');
        localStorage.removeItem(LOCAL_STORAGE_XP_KEY);
        localStorage.removeItem(LOCAL_STORAGE_EXERCISE_XP_KEY);
        localStorage.removeItem(LOCAL_STORAGE_SESSIONS_KEY);
        localStorage.removeItem(LOCAL_STORAGE_TOTAL_SESSIONS_KEY);
        // Also clear legacy key
        localStorage.removeItem('pushup_game_total_reps');

        // Snapshot guest achievement stats before clearing
        const guestStats = getGuestStatsSnapshot();
        clearGuestStats();

        if (localXp > 0 || localSessions.length > 0) {
            try {
                const userDoc = await getDoc(doc(db, 'users', uid));
                const cloudXp = userDoc.exists() ? (userDoc.data().totalXp || 0) : 0;
                const cloudSessions = userDoc.exists() ? (userDoc.data().totalSessions || 0) : 0;
                const cloudExerciseXp = userDoc.exists() ? (userDoc.data().exerciseXp || {}) : {};

                await mergeLocalDataToCloud({
                    uid, localXp, localExerciseXp, localSessions,
                    cloudXp, cloudSessions, cloudExerciseXp,
                    guestStats,
                });
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
            const xp = parseInt(localStorage.getItem(LOCAL_STORAGE_XP_KEY) ?? '0', 10) || 0;
            setTotalXp(xp);
            try {
                const raw = localStorage.getItem(LOCAL_STORAGE_EXERCISE_XP_KEY);
                setExerciseXp(raw ? JSON.parse(raw) : {});
            } catch { setExerciseXp({}); }
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

        // User profile: totalXp + exerciseXp + totalSessions
        const unsubProfile = onSnapshot(userRef, (snap) => {
            if (!snap.exists()) return;
            const data = snap.data();

            // ── Legacy migration: user has a level but no totalXp yet ─────
            // Seed totalXp from their existing level so the progress bar is coherent.
            // This write will trigger a second onSnapshot callback with the correct value.
            if (data.totalXp === undefined && typeof data.level === 'number' && data.level > 0) {
                const seededXp = totalXpForLevel(data.level);
                console.info(`[useSyncCloud] Legacy migration: seeding totalXp=${seededXp} from level=${data.level}`);
                updateDoc(snap.ref, { totalXp: seededXp }).catch(e => console.error('[useSyncCloud] Migration write failed:', e));
                // Don't set state yet — the next onSnapshot will pick up the new value
                return;
            }

            if (data.totalXp !== undefined) setTotalXp(data.totalXp);
            if (data.exerciseXp !== undefined) setExerciseXp(data.exerciseXp);
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
    }, [user, mergeLocalToCloud, setTotalXp, setExerciseXp, setSessions, setTotalSessionCount]);

    return {};
}
