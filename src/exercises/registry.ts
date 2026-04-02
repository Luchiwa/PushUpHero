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
import type { BaseExerciseDetector } from './BaseExerciseDetector';
import { PushUpDetector } from './pushup/PushUpDetector';
import { SquatDetector } from './squat/SquatDetector';
import { PullUpDetector } from './pullup/PullUpDetector';

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
        difficulty: 1.3,
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
        difficulty: 1.0,
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
        difficulty: 2.5,
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
