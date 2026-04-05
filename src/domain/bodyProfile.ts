/**
 * bodyProfile.ts
 *
 * Body Profile — morphological ratios captured during calibration.
 * Stored per exercise so that thresholds adapt to the user's unique body proportions.
 *
 * All ratios are **normalised** against the shoulder-hip distance (torso length)
 * so they are camera-distance-independent.
 */

import type { ExerciseType } from '@exercises/types';

// ── Per-exercise morphological profiles ──────────────────────────

export interface PushupProfile {
    /** Shoulder-wrist distance / shoulder-hip distance (arm reach relative to torso) */
    armToTorsoRatio: number;
    /** Shoulder-ankle spread / shoulder-hip distance (body length in plank) */
    bodySpreadRatio: number;
    /** Elbow angle when arms are fully extended in up position (degrees) */
    naturalElbowExtension: number;
    /** Minimum elbow angle reached during reps (degrees) — natural depth */
    naturalMinElbowAngle: number;
}

export interface SquatProfile {
    /** Hip-ankle distance / shoulder-hip distance (leg length relative to torso) */
    legToTorsoRatio: number;
    /** Knee angle when standing straight (degrees) */
    naturalKneeExtension: number;
    /** Ankle-ankle horizontal distance / shoulder-shoulder horizontal distance */
    stanceWidthRatio: number;
    /** Minimum knee angle reached during reps (degrees) — natural squat depth */
    naturalMinKneeAngle: number;
}

export interface PullupProfile {
    /** Shoulder-wrist distance / shoulder-hip distance in dead hang */
    armToTorsoRatio: number;
    /** Elbow angle in dead hang position (degrees) */
    naturalArmExtension: number;
    /** Maximum shoulder rise fraction achieved during reps */
    naturalMaxRiseFraction: number;
}

export interface LegRaiseProfile {
    /** Hip-ankle distance / shoulder-hip distance (leg length relative to torso) */
    legToTorsoRatio: number;
    /** Hip angle when legs are flat (degrees) */
    naturalHipExtension: number;
    /** Minimum hip angle reached during reps (degrees) — natural raise depth */
    naturalMinHipAngle: number;
}

export interface BodyProfile {
    pushup?: PushupProfile;
    squat?: SquatProfile;
    pullup?: PullupProfile;
    legraise?: LegRaiseProfile;
    /** Timestamp of last profile capture */
    capturedAt: number;
    /** Schema version for future migrations */
    version: number;
}

/** Current schema version */
export const BODY_PROFILE_VERSION = 1;

/** Create a fresh empty profile */
export function emptyBodyProfile(): BodyProfile {
    return { capturedAt: 0, version: BODY_PROFILE_VERSION };
}

// ── Adaptive thresholds ──────────────────────────────────────────
// These functions take a body profile and return personalised thresholds.

export interface PushupThresholds {
    angleUpThreshold: number;
    angleDownThreshold: number;
    perfectAmplitudeAngle: number;
}

export function getPushupThresholds(profile?: PushupProfile): PushupThresholds {
    // Reject profiles with physiologically impossible values
    if (!profile
        || profile.naturalElbowExtension < 150
        || profile.naturalMinElbowAngle < 30
        || profile.naturalMinElbowAngle >= profile.naturalElbowExtension) {
        return { angleUpThreshold: 150, angleDownThreshold: 130, perfectAmplitudeAngle: 80 };
    }
    // UP = ~5° below their natural extension (accounts for not-perfectly-straight arms)
    const angleUp = Math.min(170, Math.max(140, profile.naturalElbowExtension - 5));
    // DOWN = midpoint between their natural min and natural extension
    const midpoint = (profile.naturalElbowExtension + profile.naturalMinElbowAngle) / 2;
    const angleDown = Math.min(angleUp - 10, Math.max(90, midpoint));
    // PERFECT = their natural min + small margin (achievable but challenging)
    const perfect = Math.max(50, profile.naturalMinElbowAngle + 5);
    return { angleUpThreshold: Math.round(angleUp), angleDownThreshold: Math.round(angleDown), perfectAmplitudeAngle: Math.round(perfect) };
}

export interface SquatThresholds {
    angleUpThreshold: number;
    angleDownThreshold: number;
    perfectAmplitudeAngle: number;
}

export function getSquatThresholds(profile?: SquatProfile): SquatThresholds {
    if (!profile) {
        return { angleUpThreshold: 160, angleDownThreshold: 110, perfectAmplitudeAngle: 80 };
    }
    const angleUp = Math.min(175, Math.max(145, profile.naturalKneeExtension - 5));
    const midpoint = (profile.naturalKneeExtension + profile.naturalMinKneeAngle) / 2;
    const angleDown = Math.min(angleUp - 15, Math.max(80, midpoint));
    const perfect = Math.max(50, profile.naturalMinKneeAngle + 5);
    return { angleUpThreshold: Math.round(angleUp), angleDownThreshold: Math.round(angleDown), perfectAmplitudeAngle: Math.round(perfect) };
}

export interface PullupThresholds {
    riseUpFraction: number;
    perfectRiseFraction: number;
}

export function getPullupThresholds(profile?: PullupProfile): PullupThresholds {
    if (!profile) {
        return { riseUpFraction: 0.35, perfectRiseFraction: 0.55 };
    }
    // UP = 70% of their best rise (achievable)
    const riseUp = Math.max(0.2, profile.naturalMaxRiseFraction * 0.7);
    // PERFECT = 90% of their best rise
    const perfect = Math.max(riseUp + 0.1, profile.naturalMaxRiseFraction * 0.9);
    return {
        riseUpFraction: Math.round(riseUp * 100) / 100,
        perfectRiseFraction: Math.round(perfect * 100) / 100,
    };
}

export interface LegRaiseThresholds {
    angleUpThreshold: number;
    angleDownThreshold: number;
    perfectAmplitudeAngle: number;
}

export function getLegRaiseThresholds(profile?: LegRaiseProfile): LegRaiseThresholds {
    if (!profile
        || profile.naturalHipExtension < 140
        || profile.naturalMinHipAngle < 30
        || profile.naturalMinHipAngle >= profile.naturalHipExtension) {
        return { angleUpThreshold: 155, angleDownThreshold: 110, perfectAmplitudeAngle: 85 };
    }
    const angleUp = Math.min(170, Math.max(140, profile.naturalHipExtension - 5));
    const midpoint = (profile.naturalHipExtension + profile.naturalMinHipAngle) / 2;
    const angleDown = Math.min(angleUp - 15, Math.max(80, midpoint));
    const perfect = Math.max(50, profile.naturalMinHipAngle + 5);
    return { angleUpThreshold: Math.round(angleUp), angleDownThreshold: Math.round(angleDown), perfectAmplitudeAngle: Math.round(perfect) };
}

// ── Calibration speed boost ──────────────────────────────────────

/** Frames needed for calibration: fewer if we have a profile for this exercise */
export function getCalibrationFrames(profile: BodyProfile, exercise: ExerciseType): number {
    const hasProfile = profile[exercise] != null;
    return hasProfile ? 45 : 90; // ~1.5s vs ~3s at 30fps
}
