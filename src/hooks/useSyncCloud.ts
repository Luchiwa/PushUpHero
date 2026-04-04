import { useEffect } from 'react';
import { useAuthCore } from './useAuth';
import { totalXpForLevel } from '@domain/xpSystem';
import { migrateLegacyXp } from '@services/profileService';
import { mergeGuestDataToCloud, LS_XP_KEY, LS_EXERCISE_XP_KEY, LS_SESSIONS_KEY, LS_TOTAL_SESSIONS_KEY } from '@services/guestMerge';
import { onUserDoc } from '@data/userRepository';
import { onRecentSessions } from '@data/sessionRepository';
import type { SessionRecord } from '@exercises/types';
import type { ExerciseXpMap } from './useLevelSystem';

/**
 * useSyncCloud
 *
 * Single instance — mounted once inside AppServices.
 * Handles cloud ↔ local synchronisation:
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

    useEffect(() => {
        if (!user) {
            // Guest: seed state from localStorage
            const xp = parseInt(localStorage.getItem(LS_XP_KEY) ?? '0', 10) || 0;
            setTotalXp(xp);
            try {
                const raw = localStorage.getItem(LS_EXERCISE_XP_KEY);
                setExerciseXp(raw ? JSON.parse(raw) : {});
            } catch { setExerciseXp({}); }
            try {
                const raw = localStorage.getItem(LS_SESSIONS_KEY);
                setSessions(raw ? JSON.parse(raw) : []);
            } catch { setSessions([]); }
            const count = parseInt(localStorage.getItem(LS_TOTAL_SESSIONS_KEY) ?? '0', 10) || 0;
            setTotalSessionCount(count);
            return;
        }

        mergeGuestDataToCloud(user.uid);

        // User profile: totalXp + exerciseXp + totalSessions
        const unsubProfile = onUserDoc(user.uid, (data) => {
            // ── Legacy migration: user has a level but no totalXp yet ─────
            if (data.totalXp === undefined && typeof data.level === 'number' && data.level > 0) {
                const seededXp = totalXpForLevel(data.level);
                migrateLegacyXp(user.uid, seededXp).catch(e => console.error('[useSyncCloud] Migration write failed:', e));
                return;
            }

            if (data.totalXp !== undefined) setTotalXp(data.totalXp);
            if (data.exerciseXp !== undefined) setExerciseXp(data.exerciseXp);
            if (data.totalSessions !== undefined) setTotalSessionCount(data.totalSessions);
        });

        // Sessions subcollection (last 5 — enough for the history panel)
        const unsubSessions = onRecentSessions(user.uid, setSessions);

        return () => { unsubProfile(); unsubSessions(); };
    }, [user, setTotalXp, setExerciseXp, setSessions, setTotalSessionCount]);

    return {};
}
