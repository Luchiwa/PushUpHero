import { useEffect } from 'react';
import { useAuthCore } from './useAuth';
import { totalXpForLevel } from '@domain/xpSystem';
import { migrateLegacyXp } from '@services/profileService';
import { mergeGuestDataToCloud } from '@services/guestMerge';
import { read, STORAGE_KEYS } from '@infra/storage';
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
            setTotalXp(read(STORAGE_KEYS.totalXp, 0));
            setExerciseXp(read<ExerciseXpMap>(STORAGE_KEYS.exerciseXp, {}));
            setSessions(read<SessionRecord[]>(STORAGE_KEYS.sessions, []));
            setTotalSessionCount(read(STORAGE_KEYS.totalSessions, 0));
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
