/**
 * guestMerge.ts
 *
 * Orchestrates merging guest localStorage data into Firestore on first login.
 * Pure async function — no React, no hooks.
 */

import { getDoc } from 'firebase/firestore';
import { userRef } from '@infra/refs';
import { mergeLocalDataToCloud } from './userService';
import type { SessionRecord } from '@exercises/types';
import { getGuestStatsSnapshot, clearGuestStats } from './guestStatsStore';

// ── localStorage keys shared with useSyncCloud (guest seed) ─────────────────
export const LS_XP_KEY = 'pushup_hero_total_xp';
export const LS_EXERCISE_XP_KEY = 'pushup_hero_exercise_xp';
export const LS_SESSIONS_KEY = 'pushup-sessions';
export const LS_TOTAL_SESSIONS_KEY = 'pushup_game_total_sessions';
const MERGE_LOCK_KEY = 'pushup_merge_in_progress';

/**
 * Reads guest data from localStorage, claims a merge lock,
 * clears local storage, snapshots guest stats, and pushes
 * everything to Firestore via `mergeLocalDataToCloud`.
 */
export async function mergeGuestDataToCloud(uid: string): Promise<void> {
    if (localStorage.getItem(MERGE_LOCK_KEY) === 'true') return;

    const localXp = parseInt(localStorage.getItem(LS_XP_KEY) ?? '0', 10) || 0;
    let localExerciseXp: Partial<Record<string, number>> = {};
    try {
        const raw = localStorage.getItem(LS_EXERCISE_XP_KEY);
        if (raw) localExerciseXp = JSON.parse(raw);
    } catch { /* skip */ }
    let localSessions: SessionRecord[] = [];
    try {
        const raw = localStorage.getItem(LS_SESSIONS_KEY);
        if (raw) localSessions = JSON.parse(raw);
    } catch { /* malformed data — skip */ }

    // Claim the lock and clear local storage before any async work
    localStorage.setItem(MERGE_LOCK_KEY, 'true');
    localStorage.removeItem(LS_XP_KEY);
    localStorage.removeItem(LS_EXERCISE_XP_KEY);
    localStorage.removeItem(LS_SESSIONS_KEY);
    localStorage.removeItem(LS_TOTAL_SESSIONS_KEY);
    localStorage.removeItem('pushup_game_total_reps');

    // Snapshot guest achievement stats before clearing
    const guestStats = getGuestStatsSnapshot();
    clearGuestStats();

    if (localXp > 0 || localSessions.length > 0) {
        try {
            const userDoc = await getDoc(userRef(uid));
            const cloudXp = userDoc.exists() ? (userDoc.data().totalXp || 0) : 0;
            const cloudSessions = userDoc.exists() ? (userDoc.data().totalSessions || 0) : 0;
            const cloudExerciseXp = userDoc.exists() ? (userDoc.data().exerciseXp || {}) : {};

            await mergeLocalDataToCloud({
                uid, localXp, localExerciseXp, localSessions,
                cloudXp, cloudSessions, cloudExerciseXp,
                guestStats,
            });
        } catch (e) {
            console.error('[guestMerge] Merge failed:', e);
        }
    }

    localStorage.removeItem(MERGE_LOCK_KEY);
}
