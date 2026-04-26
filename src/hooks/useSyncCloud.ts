import { useEffect } from 'react';
import i18n from 'i18next';
import { useAuthCore } from './useAuth';
import { createLevel, createXpAmount, totalXpForLevel, type XpAmount } from '@domain';
import { migrateLegacyXp } from '@services/profileService';
import { mergeGuestDataToCloud } from '@services/guestMerge';
import { read, STORAGE_KEYS } from '@infra/storage';
import { onUserDoc } from '@data/userRepository';
import { onRecentSessions } from '@data/sessionRepository';
import type { SessionRecord, ExerciseXpMap } from '@exercises/types';

const SUPPORTED_UI_LANGS = ['fr', 'en'] as const;

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
    setTotalXp: (xp: XpAmount) => void,
    setExerciseXp: (map: ExerciseXpMap) => void,
    setSessions: (sessions: SessionRecord[]) => void,
    setTotalSessionCount: (count: number) => void,
) {
    const { user } = useAuthCore();

    useEffect(() => {
        if (!user) {
            // Guest: seed state from localStorage
            setTotalXp(createXpAmount(read(STORAGE_KEYS.totalXp, 0)));
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
                const seededXp = totalXpForLevel(createLevel(data.level));
                migrateLegacyXp(user.uid, seededXp).catch(e => console.error('[useSyncCloud] Migration write failed:', e));
                return;
            }

            if (data.totalXp !== undefined) setTotalXp(createXpAmount(data.totalXp));
            if (data.exerciseXp !== undefined) setExerciseXp(data.exerciseXp);
            if (data.totalSessions !== undefined) setTotalSessionCount(data.totalSessions);

            // ── UI language preference: Firestore → client (one-way) ──
            // The reverse direction is handled by useChangeLanguage at the
            // moment of the click — no loop because we only switch when
            // the cloud value differs from the active i18next.language.
            const cloudLang = data.preferredLanguage;
            if (cloudLang && (SUPPORTED_UI_LANGS as readonly string[]).includes(cloudLang) && i18n.language !== cloudLang) {
                void i18n.changeLanguage(cloudLang);
            }
        });

        // Sessions subcollection (last 5 — enough for the history panel)
        const unsubSessions = onRecentSessions(user.uid, setSessions);

        return () => { unsubProfile(); unsubSessions(); };
    }, [user, setTotalXp, setExerciseXp, setSessions, setTotalSessionCount]);

    return {};
}
