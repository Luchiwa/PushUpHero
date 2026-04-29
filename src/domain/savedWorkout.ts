/**
 * savedWorkout — Domain shape for user-named workout templates.
 *
 * Pure: zero side effects, zero Firebase/browser API imports. The persistence
 * layer (`@infra/firestoreValidators`, `@data/savedWorkoutRepository`,
 * `@services/savedWorkoutService`) maps this shape to/from Firestore.
 */

import type { WorkoutPlan } from '@exercises/types';

export interface SavedWorkout {
    id: string;
    name: string;
    plan: WorkoutPlan;
    /** Unix ms — set by the service on create, immutable thereafter. */
    createdAt: number;
    /** Unix ms — null until the template has been launched at least once. */
    lastUsedAt: number | null;
    /** Schema version. Bump when `WorkoutPlan` evolves to enable migrations. */
    version: 1;
}

export const SAVED_WORKOUT_NAME_MIN = 1;
export const SAVED_WORKOUT_NAME_MAX = 50;

/**
 * Validate + normalize a user-submitted name. Returns the trimmed value on
 * success. Throws an i18n-keyed Error on failure — callers pass `err.message`
 * straight to `t()`.
 *
 * Unicode is allowed; duplicates across the user's listing are allowed (the
 * UI handles disambiguation by id).
 */
export function validateSavedWorkoutName(raw: string): string {
    const trimmed = raw.trim();
    if (trimmed.length < SAVED_WORKOUT_NAME_MIN || trimmed.length > SAVED_WORKOUT_NAME_MAX) {
        throw new Error('errors:savedWorkout.invalid_name');
    }
    return trimmed;
}
