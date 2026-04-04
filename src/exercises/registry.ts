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
import type { BodyProfile } from '@domain/bodyProfile';
import { PushUpDetector } from './pushup/PushUpDetector';
import { SquatDetector } from './squat/SquatDetector';
import { PullUpDetector } from './pullup/PullUpDetector';
import { EXERCISE_DIFFICULTY } from './exerciseDifficulty';

// ── Config types ────────────────────────────────────────────────

export interface PositionGuideConfig {
    emoji: string;
    title: string;
    description: string;
    calibrationText: string;
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
    /** Voice coach phrases spoken during calibration */
    calibrationPhrases: string[];
    /** Voice coach phrases for incomplete reps (didn't reach full depth) */
    incompleteRepPhrases: string[];
}

// ── Registry ────────────────────────────────────────────────────

export const EXERCISE_REGISTRY: Record<ExerciseType, ExerciseConfig> = {
    pushup: {
        createDetector: () => new PushUpDetector(),
        difficulty: EXERCISE_DIFFICULTY.pushup,
        keyJoints: new Set([11, 12, 13, 14, 15, 16, 23, 24]),
        positionGuide: {
            emoji: '🧑‍💻',
            title: 'Get in plank position',
            description: 'Place your phone so the camera can see your full body in push-up stance.',
            calibrationText: 'Hold plank…',
        },
        calibrationPhrases: [
            'Get in plank position',
            'Place your phone to see your full body',
            'Arms straight, body horizontal',
        ],
        incompleteRepPhrases: ['Go lower!', 'Deeper!', 'Full range of motion'],
    },
    squat: {
        createDetector: () => new SquatDetector(),
        difficulty: EXERCISE_DIFFICULTY.squat,
        keyJoints: new Set([11, 12, 23, 24, 25, 26, 27, 28]),
        positionGuide: {
            emoji: '🦵',
            title: 'Stand facing the camera',
            description: 'Step back so your full body is visible from head to feet.',
            calibrationText: 'Stand still…',
        },
        calibrationPhrases: [
            'Stand facing the camera',
            'Step back so your full body is visible',
            'Stand tall, feet shoulder width',
        ],
        incompleteRepPhrases: ['Go deeper!', 'Lower!', 'Break parallel'],
    },
    pullup: {
        createDetector: () => new PullUpDetector(),
        difficulty: EXERCISE_DIFFICULTY.pullup,
        keyJoints: new Set([11, 12, 13, 14, 15, 16, 23, 24]),
        positionGuide: {
            emoji: '💪',
            title: 'Hang from the bar',
            description: 'Position the camera so your full body hangs visible, arms extended.',
            calibrationText: 'Hold hang…',
        },
        calibrationPhrases: [
            'Hang from the bar',
            'Let the camera see your full body',
            'Arms fully extended',
        ],
        incompleteRepPhrases: ['Pull higher!', 'Chin over bar!', 'All the way up!'],
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
};
