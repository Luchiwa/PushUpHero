/**
 * achievementEngine.ts
 *
 * Pure evaluation functions — no React, no Firestore writes.
 * Given user stats + current achievements, returns newly unlocked achievements
 * and updated records.
 *
 * @see achievements.ts  for the static registry
 * @see ACHIEVEMENTS.md  for the full design document
 */

import type { ExerciseType, SessionRecord } from '@exercises/types';
import type { AchievementDef } from './achievements';
import { ACHIEVEMENTS } from './achievements';
import { getGradeLetter } from './constants';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Map of achievementId → unlock timestamp (millis). Stored in Firestore. */
export type AchievementMap = Record<string, number>;

export interface RecordEntry {
    value: number;
    date: number;       // timestamp millis
    sessionId?: string;
}

export interface RecordsMap {
    maxRepsInSession: Partial<Record<ExerciseType, RecordEntry>>;
    longestWorkout: RecordEntry | null;
    bestGrade: RecordEntry | null;
    mostXpInSession: RecordEntry | null;
    mostSessionsInWeek: { value: number; weekStart: string } | null;
    longestStreak: { value: number; date: number } | null;
}

export function emptyRecords(): RecordsMap {
    return {
        maxRepsInSession: {},
        longestWorkout: null,
        bestGrade: null,
        mostXpInSession: null,
        mostSessionsInWeek: null,
        longestStreak: null,
    };
}

// ─── Stat snapshot (all the values achievements check against) ───────────────

export interface UserStats {
    // Per-exercise lifetime reps (derived from exerciseXp isn't right — we need actual reps)
    // For now we pass these explicitly from the session history
    lifetimeRepsByExercise: Partial<Record<ExerciseType, number>>;
    /** Reps per exercise in the CURRENT session (for single-session achievements) */
    sessionRepsByExercise: Partial<Record<ExerciseType, number>>;

    totalSessions: number;
    bestStreak: number;
    friendsCount: number;
    totalEncouragementsSent: number;

    /** Number of S-grade workouts (lifetime) */
    sGradeCount: number;
    /** XP earned in current session */
    sessionXp: number;
    /** Current global level */
    globalLevel: number;
    /** Cumulative training time in seconds */
    lifetimeTrainingTime: number;
}

// ─── Evaluate achievements ───────────────────────────────────────────────────

/**
 * Given current stats and already-unlocked achievements,
 * returns the list of achievements that are **newly** unlocked.
 */
export function evaluateAchievements(
    stats: UserStats,
    alreadyUnlocked: AchievementMap,
): AchievementDef[] {
    const now = Date.now();
    const newlyUnlocked: AchievementDef[] = [];

    for (const ach of ACHIEVEMENTS) {
        // Skip already unlocked
        if (alreadyUnlocked[ach.id]) continue;

        const value = getStatValue(stats, ach);
        if (value >= ach.threshold) {
            newlyUnlocked.push(ach);
            // Mark as unlocked so subsequent checks in same batch see it
            alreadyUnlocked[ach.id] = now;
        }
    }

    return newlyUnlocked;
}

/** Resolve the current value for an achievement's statKey */
export function getStatValue(stats: UserStats, ach: AchievementDef): number {
    const key = ach.statKey;

    // Per-exercise stats: `${exerciseType}_lifetime_reps` / `${exerciseType}_session_reps`
    // Adding a new exercise requires zero changes here.
    if (key.endsWith('_lifetime_reps')) {
        const ex = key.replace('_lifetime_reps', '') as ExerciseType;
        return stats.lifetimeRepsByExercise[ex] ?? 0;
    }
    if (key.endsWith('_session_reps')) {
        const ex = key.replace('_session_reps', '') as ExerciseType;
        return stats.sessionRepsByExercise[ex] ?? 0;
    }

    // Global stats
    switch (key) {
        case 'totalSessions':              return stats.totalSessions;
        case 'bestStreak':                 return stats.bestStreak;
        case 'friendsCount':              return stats.friendsCount;
        case 'totalEncouragementsSent':   return stats.totalEncouragementsSent;
        case 'sGradeCount':              return stats.sGradeCount;
        case 'sessionXp':                return stats.sessionXp;
        case 'globalLevel':              return stats.globalLevel;
        case 'lifetimeTrainingTime':     return stats.lifetimeTrainingTime;
        default: return 0;
    }
}

/** Returns true if the statKey represents a value that changes mid-session (rep-based). */
export function isLiveStatKey(statKey: string): boolean {
    return statKey.endsWith('_lifetime_reps') || statKey.endsWith('_session_reps');
}

// ─── Compute progress for a single achievement ──────────────────────────────

export interface AchievementProgress {
    def: AchievementDef;
    unlocked: boolean;
    unlockedAt: number | null; // timestamp millis or null
    current: number;
    progressPct: number; // 0–100, clamped
}

export function getAchievementProgress(
    ach: AchievementDef,
    stats: UserStats,
    unlocked: AchievementMap,
): AchievementProgress {
    const current = getStatValue(stats, ach);
    const isUnlocked = !!unlocked[ach.id];
    return {
        def: ach,
        unlocked: isUnlocked,
        unlockedAt: unlocked[ach.id] ?? null,
        current,
        progressPct: Math.min(100, (current / ach.threshold) * 100),
    };
}

// ─── Records evaluation ─────────────────────────────────────────────────────

export interface RecordUpdate {
    key: string;
    oldValue: number | null;
    newValue: number;
}

/**
 * Given the current records and a newly completed session,
 * returns updated records map + list of records that were broken.
 */
export function evaluateRecords(
    currentRecords: RecordsMap,
    session: SessionRecord,
    allSessions: SessionRecord[],
    bestStreak: number,
): { records: RecordsMap; broken: RecordUpdate[] } {
    const records: RecordsMap = JSON.parse(JSON.stringify(currentRecords));
    const broken: RecordUpdate[] = [];

    // ── Max reps in a session per exercise ───────────────────────────────
    const exerciseType = (session.exerciseType ?? 'pushup') as ExerciseType;
    // For multi-exercise sessions, aggregate reps per exercise from sets
    const repsMap: Partial<Record<ExerciseType, number>> = {};
    if (session.sets && session.sets.length > 0) {
        for (const set of session.sets) {
            const ex = (set.exerciseType ?? exerciseType) as ExerciseType;
            repsMap[ex] = (repsMap[ex] ?? 0) + set.reps;
        }
    } else {
        repsMap[exerciseType] = session.reps;
    }

    for (const [ex, reps] of Object.entries(repsMap) as [ExerciseType, number][]) {
        const prev = records.maxRepsInSession[ex]?.value ?? 0;
        if (reps > prev) {
            broken.push({ key: `maxRepsInSession.${ex}`, oldValue: prev || null, newValue: reps });
            records.maxRepsInSession[ex] = { value: reps, date: session.date, sessionId: session.id };
        }
    }

    // ── Longest workout ──────────────────────────────────────────────────
    const duration = session.totalDuration ?? session.elapsedTime ?? 0;
    const prevDuration = records.longestWorkout?.value ?? 0;
    if (duration > prevDuration) {
        broken.push({ key: 'longestWorkout', oldValue: prevDuration || null, newValue: duration });
        records.longestWorkout = { value: duration, date: session.date, sessionId: session.id };
    }

    // ── Best grade ───────────────────────────────────────────────────────
    const score = session.averageScore;
    const prevScore = records.bestGrade?.value ?? 0;
    if (score > prevScore) {
        broken.push({ key: 'bestGrade', oldValue: prevScore || null, newValue: score });
        records.bestGrade = { value: score, date: session.date, sessionId: session.id };
    }

    // ── Most XP in a session ─────────────────────────────────────────────
    const xp = session.xpEarned ?? 0;
    const prevXp = records.mostXpInSession?.value ?? 0;
    if (xp > prevXp) {
        broken.push({ key: 'mostXpInSession', oldValue: prevXp || null, newValue: xp });
        records.mostXpInSession = { value: xp, date: session.date, sessionId: session.id };
    }

    // ── Most sessions in a week ──────────────────────────────────────────
    const weekCounts = computeWeeklyCounts(allSessions);
    let bestWeek = records.mostSessionsInWeek;
    for (const [weekStart, count] of Object.entries(weekCounts)) {
        if (!bestWeek || count > bestWeek.value) {
            broken.push({ key: 'mostSessionsInWeek', oldValue: bestWeek?.value ?? null, newValue: count });
            bestWeek = { value: count, weekStart };
        }
    }
    records.mostSessionsInWeek = bestWeek;

    // ── Longest streak ───────────────────────────────────────────────────
    const prevStreak = records.longestStreak?.value ?? 0;
    if (bestStreak > prevStreak) {
        broken.push({ key: 'longestStreak', oldValue: prevStreak || null, newValue: bestStreak });
        records.longestStreak = { value: bestStreak, date: Date.now() };
    }

    return { records, broken };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Get Monday-based ISO week start string for a date */
function getWeekStart(date: Date): string {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    d.setDate(diff);
    return d.toISOString().slice(0, 10);
}

/** Count sessions per ISO week */
function computeWeeklyCounts(sessions: SessionRecord[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const s of sessions) {
        const week = getWeekStart(new Date(s.date));
        counts[week] = (counts[week] ?? 0) + 1;
    }
    return counts;
}

/**
 * Count lifetime reps per exercise from all sessions.
 * Used for first-login bulk evaluation.
 */
export function computeLifetimeReps(sessions: SessionRecord[]): Partial<Record<ExerciseType, number>> {
    const reps: Partial<Record<ExerciseType, number>> = {};
    for (const s of sessions) {
        if (s.sets && s.sets.length > 0) {
            for (const set of s.sets) {
                const ex = (set.exerciseType ?? s.exerciseType ?? 'pushup') as ExerciseType;
                reps[ex] = (reps[ex] ?? 0) + set.reps;
            }
        } else {
            const ex = (s.exerciseType ?? 'pushup') as ExerciseType;
            reps[ex] = (reps[ex] ?? 0) + s.reps;
        }
    }
    return reps;
}

/**
 * Count S-grade sessions from all sessions.
 */
export function countSGrades(sessions: SessionRecord[]): number {
    return sessions.filter(s => getGradeLetter(s.averageScore) === 'S').length;
}

/**
 * Bulk-evaluate records from a full session list.
 * Used for first-login merge or rebuilding records.
 *
 * @param initialRecords - Optional starting records (e.g. from guest localStorage).
 *                         Defaults to empty records.
 */
export function bulkEvaluateRecords(
    sessions: SessionRecord[],
    bestStreak: number,
    initialRecords?: RecordsMap,
): RecordsMap {
    let records = initialRecords ? JSON.parse(JSON.stringify(initialRecords)) as RecordsMap : emptyRecords();
    // Process sessions chronologically
    const sorted = [...sessions].sort((a, b) => a.date - b.date);
    for (const session of sorted) {
        const { records: updated } = evaluateRecords(records, session, sorted, bestStreak);
        records = updated;
    }
    return records;
}
