/**
 * Exercise Registry — Central configuration for every exercise type.
 *
 * Adding a new exercise:
 * 1. Create the detector in exercises/<name>/<Name>Detector.ts
 * 2. Add an entry here
 * 3. Add the ExerciseType literal + EXERCISE_META entry in exercises/types.ts
 * 4. Add KEY_JOINTS entry in workers/poseOverlay.worker.ts (Web Worker can't import this)
 *
 * Every other file reads from this registry — no other changes needed.
 */
import type { ExerciseType } from './types';
import type { BaseExerciseDetector, CapturedRatios } from './BaseExerciseDetector';
import type { BodyProfile } from '@domain';
import { PushUpDetector } from './pushup/PushUpDetector';
import { SquatDetector } from './squat/SquatDetector';
import { PullUpDetector } from './pullup/PullUpDetector';
import { LegRaiseDetector } from './legraise/LegRaiseDetector';
import { EXERCISE_DIFFICULTY } from './exerciseDifficulty';

// ── Config types ────────────────────────────────────────────────

/** Position-guide config — emoji is data; the three text fields are i18next
 *  keys (resolved via `t()` in PositionGuide). */
export interface PositionGuideConfig {
    emoji: string;
    titleKey: string;
    descriptionKey: string;
    calibrationKey: string;
}

export interface ExerciseConfig {
    /** Factory — creates a fresh detector instance */
    createDetector: () => BaseExerciseDetector;
    /** XP difficulty multiplier (1.0 = baseline). Squat is easiest, pull-up hardest. */
    difficulty: number;
    /** MediaPipe landmark indices to highlight on the skeleton overlay */
    keyJoints: Set<number>;
    /** Text shown on the camera feed during calibration */
    positionGuide: PositionGuideConfig;
}

// ── Registry ────────────────────────────────────────────────────

export const EXERCISE_REGISTRY: Record<ExerciseType, ExerciseConfig> = {
    pushup: {
        createDetector: () => new PushUpDetector(),
        difficulty: EXERCISE_DIFFICULTY.pushup,
        keyJoints: new Set([11, 12, 13, 14, 15, 16, 23, 24]),
        positionGuide: {
            emoji: '🧑‍💻',
            titleKey: 'dashboard:position_guide.pushup.title',
            descriptionKey: 'dashboard:position_guide.pushup.description',
            calibrationKey: 'dashboard:position_guide.pushup.calibration',
        },
    },
    squat: {
        createDetector: () => new SquatDetector(),
        difficulty: EXERCISE_DIFFICULTY.squat,
        keyJoints: new Set([11, 12, 23, 24, 25, 26, 27, 28]),
        positionGuide: {
            emoji: '🦵',
            titleKey: 'dashboard:position_guide.squat.title',
            descriptionKey: 'dashboard:position_guide.squat.description',
            calibrationKey: 'dashboard:position_guide.squat.calibration',
        },
    },
    pullup: {
        createDetector: () => new PullUpDetector(),
        difficulty: EXERCISE_DIFFICULTY.pullup,
        keyJoints: new Set([11, 12, 13, 14, 15, 16, 23, 24]),
        positionGuide: {
            emoji: '💪',
            titleKey: 'dashboard:position_guide.pullup.title',
            descriptionKey: 'dashboard:position_guide.pullup.description',
            calibrationKey: 'dashboard:position_guide.pullup.calibration',
        },
    },
    legraise: {
        createDetector: () => new LegRaiseDetector(),
        difficulty: EXERCISE_DIFFICULTY.legraise,
        keyJoints: new Set([11, 12, 23, 24, 25, 26, 27, 28]),
        positionGuide: {
            emoji: '🧘',
            titleKey: 'dashboard:position_guide.legraise.title',
            descriptionKey: 'dashboard:position_guide.legraise.description',
            calibrationKey: 'dashboard:position_guide.legraise.calibration',
        },
    },
};

// ── Body Profile Merge Map ─────────────────────────────────────
// Data-driven mapping: each exercise type declares how to merge captured ratios
// into the BodyProfile. Adding a new exercise = adding one entry here.
// Lives in the exercises module (not domain/) because it's per-exercise config
// that depends on CapturedRatios.

export const BODY_PROFILE_MERGE: Record<ExerciseType, (
  captured: CapturedRatios,
  dynamicCalibration: number | undefined,
) => Partial<BodyProfile>> = {
  pushup: (c, cal) => c.pushup ? {
    pushup: {
      ...c.pushup,
      naturalMinElbowAngle: cal ?? c.pushup.naturalElbowExtension - 70,
    },
  } : {},
  squat: (c, cal) => c.squat ? {
    squat: {
      ...c.squat,
      naturalMinKneeAngle: cal ?? c.squat.naturalKneeExtension - 70,
    },
  } : {},
  pullup: (c, cal) => c.pullup ? {
    pullup: {
      ...c.pullup,
      naturalMaxRiseFraction: cal ?? 0.5,
    },
  } : {},
  legraise: (c, cal) => c.legraise ? {
    legraise: {
      ...c.legraise,
      naturalMinHipAngle: cal ?? c.legraise.naturalHipExtension - 70,
    },
  } : {},
};
