/**
 * workoutPlan — Pure structural helpers over `WorkoutPlan`.
 *
 * Lives separate from `xpSystem` because it has nothing to do with XP. If
 * a helper here grows to need XP / scoring / level context, it likely
 * belongs back in those files.
 */
import type { WorkoutPlan } from '@exercises/types';

/** Total number of sets across all blocks of a plan. */
export function getTotalSets(plan: WorkoutPlan): number {
    return plan.blocks.reduce((sum, b) => sum + b.numberOfSets, 0);
}
