// ─── Central configuration constants ─────────────────────────────────────────
// Single source of truth for magic numbers used across the app.

// ── Calibration ──────────────────────────────────────────────────────────────
/** Frames of stable plank position required before reps are counted (~3s at 30fps) */
export const CALIBRATION_FRAMES_REQUIRED = 90;

// ── Sessions & Storage ───────────────────────────────────────────────────────
/** Max number of sessions kept in localStorage for guest users */
export const MAX_LOCAL_SESSIONS = 5;

/** Number of activity feed events fetched per friend */
export const EVENTS_PER_FRIEND = 5;

/** Activity feed events older than this (ms) are pruned on each session save */
export const FEED_PRUNE_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ── Social ───────────────────────────────────────────────────────
/** Minimum time between two encouragement sends to the same friend (ms) */
export const ENCOURAGE_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

// ── Multi-Set ────────────────────────────────────────────────────
/** Minimum number of sets for a workout */
export const MIN_SETS = 1;
/** Maximum number of sets for a workout */
export const MAX_SETS = 10;
/** Minimum rest duration between sets (seconds) */
export const MIN_REST_SECONDS = 10;
/** Maximum rest duration between sets (seconds) */
export const MAX_REST_SECONDS = 300; // 5 minutes
/** Default rest duration between sets (seconds) */
export const DEFAULT_REST_SECONDS = 60;

// ── Multi-Exercise ───────────────────────────────────────────────
/** Maximum rest between exercises (seconds) */
export const MAX_EXERCISE_REST_SECONDS = 600; // 10 minutes
/** Default rest between exercises (seconds) */
export const DEFAULT_EXERCISE_REST_SECONDS = 120; // 2 minutes

// ── Grade system ─────────────────────────────────────────────────────────────
// Unified thresholds — used everywhere: SummaryScreen, FriendsFeedPanel, ActivityFeed

export type GradeLetter = 'S' | 'A' | 'B' | 'C' | 'D';

const GRADE_THRESHOLDS: { min: number; letter: GradeLetter }[] = [
    { min: 90, letter: 'S' },
    { min: 75, letter: 'A' },
    { min: 60, letter: 'B' },
    { min: 45, letter: 'C' },
];

export function getGradeLetter(score: number): GradeLetter {
    for (const { min, letter } of GRADE_THRESHOLDS) {
        if (score >= min) return letter;
    }
    return 'D';
}

/** Grade color via CSS custom property (defined in _variables.scss). */
export function getGradeColor(score: number): string {
    return `var(--grade-${getGradeLetter(score).toLowerCase()})`;
}

/** Translucent background color for a grade badge */
export function getGradeBackground(score: number): string {
    return `color-mix(in srgb, var(--grade-${getGradeLetter(score).toLowerCase()}) 10%, transparent)`;
}

/** CSS class suffix for a grade letter (e.g. 'grade-s') */
export function getGradeClass(score: number): string {
    return `grade-${getGradeLetter(score).toLowerCase()}`;
}

// ── Formatting ─────────────────────────────────────────────────────

/** Format seconds into a human-readable string (e.g. `3min45s`). Returns '' for falsy values. */
export function formatElapsedTime(seconds?: number): string {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) return `${mins}min${secs}s`;
    return `${secs}s`;
}
