/**
 * stats.ts — Pure helpers for stats screens (WeeklyChart, KPIGrid).
 * No React, no Firebase. Testable with simple assert().
 */
import type { ExerciseType, SessionRecord } from '@exercises/types';
import { formatNumber } from './format';

export type ExerciseFilter = 'all' | ExerciseType;

// ─── Weekly aggregations ────────────────────────────────────────

/**
 * Count reps per day of the week (Sunday-anchored).
 * `weekOffset` 0 = current week, -1 = last week, etc.
 * For multi-exercise sessions filtered by type, only count reps from matching blocks.
 */
export function buildDayTotals(
    sessions: SessionRecord[],
    weekOffset: number,
    exerciseFilter: ExerciseFilter = 'all',
): number[] {
    const totals = [0, 0, 0, 0, 0, 0, 0];
    const sunday = sundayOf(weekOffset);

    sessions.forEach(s => {
        const diff = dayDiffFromSunday(s.date, sunday);
        if (diff < 0 || diff > 6) return;

        if (exerciseFilter !== 'all' && s.isMultiExercise && s.blocks && s.sets) {
            let setIdx = 0;
            for (const block of s.blocks) {
                const blockSets = s.sets.slice(setIdx, setIdx + block.numberOfSets);
                setIdx += block.numberOfSets;
                if (block.exerciseType === exerciseFilter) {
                    totals[diff] += blockSets.reduce((sum, st) => sum + st.reps, 0);
                }
            }
        } else {
            totals[diff] += s.reps;
        }
    });
    return totals;
}

/**
 * Sum XP per day (Sunday-anchored). Uses xpEarned from each session.
 * For filtered exercises, uses xpPerExercise breakdown when available.
 */
export function buildDayTotalsXp(
    sessions: SessionRecord[],
    weekOffset: number,
    exerciseFilter: ExerciseFilter = 'all',
): number[] {
    const totals = [0, 0, 0, 0, 0, 0, 0];
    const sunday = sundayOf(weekOffset);

    sessions.forEach(s => {
        const diff = dayDiffFromSunday(s.date, sunday);
        if (diff < 0 || diff > 6) return;

        if (exerciseFilter !== 'all' && s.xpPerExercise) {
            const match = s.xpPerExercise.find(e => e.exerciseType === exerciseFilter);
            if (match) totals[diff] += match.finalXp;
        } else {
            totals[diff] += s.xpEarned ?? 0;
        }
    });
    return totals;
}

function sundayOf(weekOffset: number): Date {
    const now = new Date();
    const todayDay = now.getDay();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - todayDay + weekOffset * 7);
}

function dayDiffFromSunday(sessionDate: number, sunday: Date): number {
    const d = new Date(sessionDate);
    const localDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.round((localDay.getTime() - sunday.getTime()) / 86_400_000);
}

// ─── Chart axis scaling ─────────────────────────────────────────

/** Round `value` up to the nearest "nice" axis tick (1, 2, 5 × 10^n). */
export function niceMax(value: number): number {
    if (value <= 0) return 10;
    const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
    const normalized = value / magnitude;
    const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    return nice * magnitude;
}

// ─── KPI deltas & formatting ────────────────────────────────────

/**
 * Percentage change from `previous` to `current`, rounded.
 * - Returns null when both sides are 0 (no signal to display).
 * - Returns 100 when previous is 0 and current is positive (treats 0→N as +100%).
 */
export function pctChange(current: number, previous: number): number | null {
    if (previous === 0 && current === 0) return null;
    if (previous === 0) return 100;
    return Math.round(((current - previous) / previous) * 100);
}

/** Compact a number for KPI tile display. >= 10k uses one decimal + "k". */
export function compactNum(n: number): string {
    if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`;
    return formatNumber(n);
}
