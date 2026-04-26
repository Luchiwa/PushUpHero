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
import type { AchievementMap, RecordsMap } from '@domain';
import { emptyRecords } from '@domain';
import { read, write, remove, STORAGE_KEYS } from '@infra/storage';

// ── Read ─────────────────────────────────────────────────────────────────────

export function getGuestAchievements(): AchievementMap {
    return read<AchievementMap>(STORAGE_KEYS.guestAchievements, {});
}

export function getGuestRecords(): RecordsMap {
    return read<RecordsMap>(STORAGE_KEYS.guestRecords, emptyRecords());
}

export function getGuestLifetimeReps(): Partial<Record<ExerciseType, number>> {
    return read<Partial<Record<ExerciseType, number>>>(STORAGE_KEYS.guestLifetimeReps, {});
}

export function getGuestBestStreak(): number {
    return read(STORAGE_KEYS.guestBestStreak, 0);
}

export function getGuestStreak(): number {
    return read(STORAGE_KEYS.guestStreak, 0);
}

export function getGuestLastSessionDate(): string | null {
    return read<string | null>(STORAGE_KEYS.guestLastSession, null);
}

export function getGuestSGradeCount(): number {
    return read(STORAGE_KEYS.guestSGradeCount, 0);
}

export function getGuestLifetimeTrainingTime(): number {
    return read(STORAGE_KEYS.guestTrainingTime, 0);
}

// ── Write ────────────────────────────────────────────────────────────────────

export function setGuestAchievements(map: AchievementMap): void {
    write(STORAGE_KEYS.guestAchievements, map);
}

export function setGuestRecords(records: RecordsMap): void {
    write(STORAGE_KEYS.guestRecords, records);
}

export function setGuestLifetimeReps(reps: Partial<Record<ExerciseType, number>>): void {
    write(STORAGE_KEYS.guestLifetimeReps, reps);
}

export function setGuestBestStreak(streak: number): void {
    write(STORAGE_KEYS.guestBestStreak, streak);
}

export function setGuestStreak(streak: number): void {
    write(STORAGE_KEYS.guestStreak, streak);
}

export function setGuestLastSessionDate(date: string): void {
    write(STORAGE_KEYS.guestLastSession, date);
}

export function setGuestSGradeCount(count: number): void {
    write(STORAGE_KEYS.guestSGradeCount, count);
}

export function setGuestLifetimeTrainingTime(seconds: number): void {
    write(STORAGE_KEYS.guestTrainingTime, seconds);
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
    remove(STORAGE_KEYS.guestAchievements);
    remove(STORAGE_KEYS.guestRecords);
    remove(STORAGE_KEYS.guestLifetimeReps);
    remove(STORAGE_KEYS.guestBestStreak);
    remove(STORAGE_KEYS.guestStreak);
    remove(STORAGE_KEYS.guestLastSession);
    remove(STORAGE_KEYS.guestSGradeCount);
    remove(STORAGE_KEYS.guestTrainingTime);
}
