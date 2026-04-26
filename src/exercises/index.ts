/**
 * Exercises module — public API.
 * Exercise registry, types, difficulty, and detectors.
 */

// Registry (single source of truth for exercise config)
export {
    EXERCISE_REGISTRY, BODY_PROFILE_MERGE,
    type ExerciseConfig, type PositionGuideConfig,
} from './registry';

// Types
export {
    EXERCISE_TYPES, EXERCISE_META, getExerciseLabel, getInvalidPositionMessage, createDefaultBlock,
    type ExerciseType, type ExerciseState, type ExercisePhase, type Landmark, type RepResult,
    type RepFeedback, type SetRecord, type SessionRecord, type TimeDuration, type WorkoutBlock,
    type WorkoutPlan,
} from './types';

// Difficulty
export { EXERCISE_DIFFICULTY, difficultyFor } from './exerciseDifficulty';

// Base detector (for typing only — concrete detectors via registry factory)
export type { CapturedRatios } from './BaseExerciseDetector';
