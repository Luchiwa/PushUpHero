/**
 * clearLocalStorage.ts
 *
 * Central utility to purge all app localStorage keys.
 * Called on logout and account deletion to ensure no stale data remains.
 */

import { GUEST_STATS_KEYS } from './guestStatsStore';

const APP_STORAGE_KEYS = [
    'pushup-hero-body-profile',
    'pushup-hero-quest-progress',
    'pushup_hero_total_xp',
    'pushup_hero_exercise_xp',
    'pushup-sessions',
    'pushup_game_total_sessions',
    'pushup_game_total_reps',
    'pushup_merge_in_progress',
    'pushup_hero_workout_checkpoint',
    ...GUEST_STATS_KEYS,
];

/** Remove all app-owned localStorage keys (including per-user keys like feed_last_seen). */
export function clearAllLocalStorage(): void {
    for (const key of APP_STORAGE_KEYS) {
        localStorage.removeItem(key);
    }
    // Also clear dynamic per-user keys (feed_last_seen_{uid}, etc.)
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('feed_last_seen_')) {
            toRemove.push(key);
        }
    }
    for (const key of toRemove) {
        localStorage.removeItem(key);
    }
}
