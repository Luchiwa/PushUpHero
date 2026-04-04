/**
 * scoring.ts — Pure scoring helpers extracted from UI components.
 * No React, no Firebase. Testable with simple assert().
 */
import type { SetRecord } from '@exercises/types';

// ─── Combo ──────────────────────────────────────────────────────────────────

/** Minimum rep score to keep a combo going (B-grade threshold). */
export const COMBO_THRESHOLD = 60;

/** Returns the updated combo count after a rep. */
export function nextCombo(currentCombo: number, repScore: number): number {
    return repScore >= COMBO_THRESHOLD ? currentCombo + 1 : 0;
}

// ─── Goal progress ──────────────────────────────────────────────────────────

export interface GoalProgress {
    /** Progress percentage (0–100, capped). */
    pct: number;
    /** Whether the goal is reached. */
    done: boolean;
}

/** Computes goal progress for reps-mode sessions. */
export function computeGoalProgress(repCount: number, goalReps: number): GoalProgress {
    return {
        pct: goalReps > 0 ? Math.min(100, (repCount / goalReps) * 100) : 0,
        done: repCount >= goalReps,
    };
}

// ─── Weighted average score ────────────────────────────────────────────────

/**
 * Computes the rep-weighted average score across multiple sets.
 * Falls back to 0 if no reps were completed.
 */
export function weightedAverageScore(sets: Pick<SetRecord, 'reps' | 'averageScore'>[]): number {
    const totalReps = sets.reduce((sum, s) => sum + s.reps, 0);
    if (totalReps === 0) return 0;
    return Math.round(sets.reduce((sum, s) => sum + s.averageScore * s.reps, 0) / totalReps);
}
