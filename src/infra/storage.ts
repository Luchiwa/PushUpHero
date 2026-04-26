/**
 * storage — Centralized typed localStorage access.
 *
 * Sole authorized importer of `window.localStorage` outside of test code
 * (enforced by ESLint `no-restricted-globals`). Other layers must go
 * through this module so keys, value shapes, and error handling stay
 * consistent.
 *
 * Failures (quota exceeded, storage disabled in incognito/iOS ITP) are
 * silently swallowed — writes are best-effort, reads return the fallback.
 */

// ── Key registry ─────────────────────────────────────────────────────────────

/**
 * Static (non-parameterized) localStorage keys.
 *
 * All keys are prefixed `pushup_hero_` for grep-ability and to avoid
 * collisions with anything a third-party script might write.
 */
export const STORAGE_KEYS = {
    // Guest XP / sessions (consumed & cleared on first cloud login)
    totalXp:            'pushup_hero_total_xp',
    exerciseXp:         'pushup_hero_exercise_xp',
    sessions:           'pushup_hero_sessions',
    totalSessions:      'pushup_hero_total_sessions',
    // Guest stats (per-device accumulators while not logged in)
    guestAchievements:  'pushup_hero_guest_achievements',
    guestRecords:       'pushup_hero_guest_records',
    guestLifetimeReps:  'pushup_hero_guest_lifetime_reps',
    guestBestStreak:    'pushup_hero_guest_best_streak',
    guestStreak:        'pushup_hero_guest_streak',
    guestLastSession:   'pushup_hero_guest_last_session_date',
    guestSGradeCount:   'pushup_hero_guest_s_grade_count',
    guestTrainingTime:  'pushup_hero_guest_training_time',
    // System / per-device
    bodyProfile:        'pushup_hero_body_profile',
    questProgress:      'pushup_hero_quest_progress',
    workoutCheckpoint:  'pushup_hero_workout_checkpoint',
    mergeLock:          'pushup_hero_merge_lock',
    // Device-level UI preference. Wiped by `clearAppKeys` on logout, so a
    // returning guest falls back to navigator.language until they re-pick;
    // signed-in users get re-hydrated from Firestore by useSyncCloud.
    preferredLanguage:  'pushup_hero_preferred_language',
} as const;

/** Builders for parameterized (per-user) keys. */
export const STORAGE_KEY_BUILDERS = {
    feedLastSeen:   (uid: string) => `pushup_hero_feed_last_seen_${uid}`,
    encouragement:  (friendUid: string) => `pushup_hero_encouragement_${friendUid}`,
} as const;

/** Prefixes used by parameterized keys — drives `clearAppKeys` bulk wipe. */
const DYNAMIC_KEY_PREFIXES = [
    'pushup_hero_feed_last_seen_',
    'pushup_hero_encouragement_',
] as const;

// ── API ──────────────────────────────────────────────────────────────────────

/**
 * Read a JSON-serialized value. Returns `fallback` if missing, malformed,
 * or storage unavailable. Legacy compatibility: if the stored value was
 * written as a raw (non-JSON-encoded) string by a pre-migration call site,
 * it is returned as-is and gets normalized to JSON on the next `write`.
 */
export function read<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null) return fallback;
        try {
            return JSON.parse(raw) as T;
        } catch {
            // Legacy raw string written before the JSON-everywhere migration.
            return raw as unknown as T;
        }
    } catch {
        return fallback;
    }
}

/**
 * Write a JSON-serialized value. Silently no-ops if quota is exceeded or
 * storage is unavailable.
 */
export function write<T>(key: string, value: T): void {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch { /* quota exceeded or storage unavailable — best effort */ }
}

/** Remove a single key. */
export function remove(key: string): void {
    try {
        localStorage.removeItem(key);
    } catch { /* storage unavailable — best effort */ }
}

/**
 * Wipe **all** localStorage entries — third-party included. Reserved for
 * account deletion (belt-and-suspenders after the cloud-side wipe).
 */
export function clearAll(): void {
    try {
        localStorage.clear();
    } catch { /* storage unavailable — best effort */ }
}

/**
 * Remove every app-owned key — both the static registry and dynamic
 * per-user keys (matched by prefix). Used on logout so the next user
 * doesn't inherit the previous one's local cache.
 */
export function clearAppKeys(): void {
    for (const key of Object.values(STORAGE_KEYS)) {
        remove(key);
    }
    try {
        const dynamic: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && DYNAMIC_KEY_PREFIXES.some(prefix => key.startsWith(prefix))) {
                dynamic.push(key);
            }
        }
        for (const key of dynamic) remove(key);
    } catch { /* storage unavailable — best effort */ }
}
