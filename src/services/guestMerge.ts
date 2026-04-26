/**
 * guestMerge.ts
 *
 * Orchestrates merging guest localStorage data into Firestore on first login.
 * Pure async function — no React, no hooks.
 */

import { getDoc } from 'firebase/firestore';
import { userRef } from '@infra/refs';
import { read, write, remove, STORAGE_KEYS } from '@infra/storage';
import { mergeLocalDataToCloud } from './userService';
import type { SessionRecord } from '@exercises/types';
import { getGuestStatsSnapshot, clearGuestStats } from './guestStatsStore';

/**
 * Reads guest data from localStorage, claims a merge lock, clears local
 * storage, snapshots guest stats, and pushes everything to Firestore via
 * `mergeLocalDataToCloud`.
 */
export async function mergeGuestDataToCloud(uid: string): Promise<void> {
    if (read<boolean>(STORAGE_KEYS.mergeLock, false) === true) return;

    const localXp = read(STORAGE_KEYS.totalXp, 0);
    const localExerciseXp = read<Partial<Record<string, number>>>(STORAGE_KEYS.exerciseXp, {});
    const localSessions = read<SessionRecord[]>(STORAGE_KEYS.sessions, []);

    // Claim the lock and clear local storage before any async work
    write(STORAGE_KEYS.mergeLock, true);
    remove(STORAGE_KEYS.totalXp);
    remove(STORAGE_KEYS.exerciseXp);
    remove(STORAGE_KEYS.sessions);
    remove(STORAGE_KEYS.totalSessions);
    remove(STORAGE_KEYS.totalReps);

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

    remove(STORAGE_KEYS.mergeLock);
}
