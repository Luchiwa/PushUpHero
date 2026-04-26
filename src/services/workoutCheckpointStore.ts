/**
 * workoutCheckpointStore.ts
 *
 * Persists interrupted workout state to localStorage so the user can
 * resume where they left off after an interruption (phone call, app closed).
 *
 * Checkpoint is written after each completed set and cleared when the
 * workout finishes, is manually stopped, or the user discards it.
 */
import type { WorkoutPlan, SetRecord } from '@exercises/types';
import { read, write, remove, STORAGE_KEYS } from '@infra/storage';

// ── Types ───────────────────────────────────────────────────────

export interface WorkoutCheckpoint {
    /** Schema version for forward-compat migrations */
    version: 1;
    /** The full workout plan (blocks array) — needed to restore config */
    plan: WorkoutPlan;
    /** All sets completed before the interruption */
    completedSets: SetRecord[];
    /** Elapsed active workout time in milliseconds at checkpoint */
    elapsedMs: number;
    /** Unix timestamp (ms) when this checkpoint was written */
    savedAt: number;
}

// ── Public API ──────────────────────────────────────────────────

/** Read the saved checkpoint. Returns null if missing, corrupt, or invalid. */
export function getWorkoutCheckpoint(): WorkoutCheckpoint | null {
    const data = read<WorkoutCheckpoint | null>(STORAGE_KEYS.workoutCheckpoint, null);
    if (!data) return null;

    // Validate required fields
    if (
        data.version !== 1
        || !data.plan?.blocks?.length
        || !Array.isArray(data.completedSets)
        || typeof data.elapsedMs !== 'number'
        || typeof data.savedAt !== 'number'
    ) {
        remove(STORAGE_KEYS.workoutCheckpoint);
        return null;
    }

    return data;
}

/** Save a checkpoint to localStorage. */
export function saveWorkoutCheckpoint(checkpoint: WorkoutCheckpoint): void {
    write(STORAGE_KEYS.workoutCheckpoint, checkpoint);
}

/** Remove the checkpoint from localStorage. */
export function clearWorkoutCheckpoint(): void {
    remove(STORAGE_KEYS.workoutCheckpoint);
}

/**
 * Derive which block and set to resume from based on how many sets
 * have been completed vs the plan structure.
 */
export function deriveResumePosition(
    plan: WorkoutPlan,
    completedSetsCount: number,
): { blockIndex: number; setIndex: number } {
    let remaining = completedSetsCount;
    for (let b = 0; b < plan.blocks.length; b++) {
        if (remaining < plan.blocks[b].numberOfSets) {
            return { blockIndex: b, setIndex: remaining };
        }
        remaining -= plan.blocks[b].numberOfSets;
    }
    // All sets completed — shouldn't normally happen (checkpoint should be cleared)
    return { blockIndex: plan.blocks.length - 1, setIndex: 0 };
}
