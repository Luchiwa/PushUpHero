/**
 * Exercise difficulty coefficients — extracted to break the circular dependency
 * between domain/xpSystem and exercises/registry.
 *
 * Both the registry and xpSystem import from here (no cycle).
 *
 * Squat is the baseline (×1.0).
 *   pushup  ×1.3  – full upper body, requires strict form
 *   pullup  ×2.5  – bodyweight compound, very demanding
 */
import type { ExerciseType } from './types';

export const EXERCISE_DIFFICULTY: Record<ExerciseType, number> = {
    pushup: 1.3,
    squat: 1.0,
    pullup: 2.5,
};

/**
 * Returns the difficulty coefficient for a given exercise type.
 * Falls back to 1.0 for unknown types so new exercises are safe by default.
 */
export function difficultyFor(type: ExerciseType): number {
    return EXERCISE_DIFFICULTY[type] ?? 1.0;
}
