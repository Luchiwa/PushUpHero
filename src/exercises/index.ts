/**
 * Exercises module — public API.
 * Exercise registry, types, difficulty, and detectors.
 */

// Registry (single source of truth for exercise config)
export { EXERCISE_REGISTRY, BODY_PROFILE_MERGE } from './registry';
export type { ExerciseConfig, PositionGuideConfig } from './registry';

// Types
export type { ExerciseType, ExerciseState, ExercisePhase, Landmark, RepResult, RepFeedback, SetRecord, SessionRecord, TimeDuration, WorkoutBlock, WorkoutPlan } from './types';
export { EXERCISE_TYPES, EXERCISE_META, getExerciseLabel, getInvalidPositionMessage, createDefaultBlock } from './types';

// Difficulty
export { EXERCISE_DIFFICULTY, difficultyFor } from './exerciseDifficulty';

// Base detector (for typing only — concrete detectors via registry factory)
export type { CapturedRatios } from './BaseExerciseDetector';
