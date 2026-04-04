/**
 * guestStatsStore.ts
 *
 * localStorage-backed store for guest achievement progress.
 * Mirrors the subset of DbUser fields needed by the achievement engine
 * so guests get toasts, summary badges, and records — just like logged-in users.
 *
 * On first login the data is merged into Firestore and then cleared.
 */

import type { ExerciseType } from '@exercises/types';
import type { AchievementMap, RecordsMap } from '@domain/achievementEngine';
import { emptyRecords } from '@domain/achievementEngine';

// ── localStorage keys ────────────────────────────────────────────────────────

const KEY_ACHIEVEMENTS     = 'pushup_hero_guest_achievements';
const KEY_RECORDS          = 'pushup_hero_guest_records';
const KEY_LIFETIME_REPS    = 'pushup_hero_guest_lifetime_reps';
const KEY_BEST_STREAK      = 'pushup_hero_guest_best_streak';
const KEY_STREAK           = 'pushup_hero_guest_streak';
const KEY_LAST_SESSION_DATE = 'pushup_hero_guest_last_session_date';
const KEY_S_GRADE_COUNT    = 'pushup_hero_guest_s_grade_count';
const KEY_TRAINING_TIME    = 'pushup_hero_guest_training_time';

export const GUEST_STATS_KEYS = [
    KEY_ACHIEVEMENTS,
    KEY_RECORDS,
    KEY_LIFETIME_REPS,
    KEY_BEST_STREAK,
    KEY_STREAK,
    KEY_LAST_SESSION_DATE,
    KEY_S_GRADE_COUNT,
    KEY_TRAINING_TIME,
] as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

function readJSON<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function writeJSON(key: string, value: unknown): void {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch { /* quota exceeded — best effort */ }
}

function readInt(key: string, fallback: number = 0): number {
    return parseInt(localStorage.getItem(key) ?? '', 10) || fallback;
}

function writeInt(key: string, value: number): void {
    try {
        localStorage.setItem(key, value.toString());
    } catch { /* best effort */ }
}

// ── Read ─────────────────────────────────────────────────────────────────────

export function getGuestAchievements(): AchievementMap {
    return readJSON(KEY_ACHIEVEMENTS, {});
}

export function getGuestRecords(): RecordsMap {
    return readJSON(KEY_RECORDS, emptyRecords());
}

export function getGuestLifetimeReps(): Partial<Record<ExerciseType, number>> {
    return readJSON(KEY_LIFETIME_REPS, {});
}

export function getGuestBestStreak(): number {
    return readInt(KEY_BEST_STREAK);
}

export function getGuestStreak(): number {
    return readInt(KEY_STREAK);
}

export function getGuestLastSessionDate(): string | null {
    return localStorage.getItem(KEY_LAST_SESSION_DATE);
}

export function getGuestSGradeCount(): number {
    return readInt(KEY_S_GRADE_COUNT);
}

export function getGuestLifetimeTrainingTime(): number {
    return readInt(KEY_TRAINING_TIME);
}

// ── Write ────────────────────────────────────────────────────────────────────

export function setGuestAchievements(map: AchievementMap): void {
    writeJSON(KEY_ACHIEVEMENTS, map);
}

export function setGuestRecords(records: RecordsMap): void {
    writeJSON(KEY_RECORDS, records);
}

export function setGuestLifetimeReps(reps: Partial<Record<ExerciseType, number>>): void {
    writeJSON(KEY_LIFETIME_REPS, reps);
}

export function setGuestBestStreak(streak: number): void {
    writeInt(KEY_BEST_STREAK, streak);
}

export function setGuestStreak(streak: number): void {
    writeInt(KEY_STREAK, streak);
}

export function setGuestLastSessionDate(date: string): void {
    try {
        localStorage.setItem(KEY_LAST_SESSION_DATE, date);
    } catch { /* best effort */ }
}

export function setGuestSGradeCount(count: number): void {
    writeInt(KEY_S_GRADE_COUNT, count);
}

export function setGuestLifetimeTrainingTime(seconds: number): void {
    writeInt(KEY_TRAINING_TIME, seconds);
}

// ── Snapshot (read everything at once) ───────────────────────────────────────

export interface GuestStatsSnapshot {
    achievements: AchievementMap;
    records: RecordsMap;
    lifetimeReps: Partial<Record<ExerciseType, number>>;
    bestStreak: number;
    streak: number;
    lastSessionDate: string | null;
    sGradeCount: number;
    lifetimeTrainingTime: number;
}

export function getGuestStatsSnapshot(): GuestStatsSnapshot {
    return {
        achievements: getGuestAchievements(),
        records: getGuestRecords(),
        lifetimeReps: getGuestLifetimeReps(),
        bestStreak: getGuestBestStreak(),
        streak: getGuestStreak(),
        lastSessionDate: getGuestLastSessionDate(),
        sGradeCount: getGuestSGradeCount(),
        lifetimeTrainingTime: getGuestLifetimeTrainingTime(),
    };
}

/** Clear all guest stats keys (called after merge or on logout). */
export function clearGuestStats(): void {
    for (const key of GUEST_STATS_KEYS) {
        localStorage.removeItem(key);
    }
}
