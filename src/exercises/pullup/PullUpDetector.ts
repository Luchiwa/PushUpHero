import { BaseExerciseDetector } from '../BaseExerciseDetector';
import type { ExerciseState, Landmark, RepFeedback } from '../types';
import { CALIBRATION_FRAMES_REQUIRED } from '@lib/constants';

/**
 * PullUpDetector — Detects pull-up reps using **shoulder vertical displacement**
 * as the primary signal, confirmed by elbow angle.
 *
 * The camera is typically placed in front of the user (or slightly below).
 * In normalised coordinates, Y=0 is the top of the frame and Y=1 is the bottom,
 * so when the body rises, shoulder Y *decreases*.
 *
 * Rep cycle:
 *   1. DOWN (dead hang): shoulders near calibrated baseline Y, arms extended
 *   2. UP (chest to bar): shoulders have risen by a significant fraction of
 *      the shoulder-to-hip distance AND elbow angle is small
 *   3. Must return to DOWN before a new rep can begin
 */

const LM = {
    LEFT_SHOULDER: 11,
    RIGHT_SHOULDER: 12,
    LEFT_ELBOW: 13,
    RIGHT_ELBOW: 14,
    LEFT_WRIST: 15,
    RIGHT_WRIST: 16,
    LEFT_HIP: 23,
    RIGHT_HIP: 24,
} as const;

// ── Shoulder rise thresholds (fraction of shoulder-hip distance) ──
/** Minimum shoulder rise to count as "up" (e.g. 0.35 = 35% of torso length) */
const RISE_UP_FRACTION = 0.35;
/** Shoulder must return within this fraction of baseline to count as "back down" */
const RISE_DOWN_FRACTION = 0.12;
/** Perfect rep: shoulders rise by this much of torso length */
const PERFECT_RISE_FRACTION = 0.55;

// ── Elbow angle — secondary confirmation ─────────────────────────
/** Elbow angle must be below this to confirm "up" (prevents false positives) */
const ELBOW_CONFIRM_UP = 90;
/** Elbow angle must be above this to confirm "down" */
const ELBOW_CONFIRM_DOWN = 120;
const SMOOTHING_WINDOW = 5;

// ── Positional constraints ───────────────────────────────────────
const MIN_SHOULDER_HIP_SPREAD = 0.08;
const WRIST_ABOVE_SHOULDER_MARGIN = 0.15;

// ── Alignment thresholds ─────────────────────────────────────────
const ARM_SYMMETRY_TOLERANCE = 20;
const BODY_SWAY_TOLERANCE = 0.04;
const KIPPING_VELOCITY_THRESHOLD = 0.025;

export class PullUpDetector extends BaseExerciseDetector {
    private angleHistory: number[] = [];
    private shoulderYHistory: number[] = [];
    private minAngleThisRep: number = 180;
    private maxRiseThisRep: number = 0;       // best shoulder rise (fraction)
    private bestAlignmentThisRep: number = 0;
    private hasReachedValidDown = false;
    private lastRepTimestamp: number = 0;

    // Kipping detection
    private prevHipY: number | null = null;
    private maxHipVelocity: number = 0;

    // Worst deviations tracking for feedback
    private worstArmAsymmetry: number = 0;
    private worstBodySway: number = 0;

    // Track whether user was ascending (to detect incomplete reps)
    private wasAscending: boolean = false;

    // ── Calibration State ──
    private calibrationFrames: { spread: number; wristOffset: number; shoulderY: number }[] = [];
    private calibratedMinShoulderHipSpread = MIN_SHOULDER_HIP_SPREAD;
    private calibratedWristAboveShoulderMargin = WRIST_ABOVE_SHOULDER_MARGIN;
    /** Shoulder Y at dead-hang baseline (normalised) */
    private calibratedBaselineShoulderY = 0;
    /** Shoulder-hip distance at dead hang — used as the "torso length" reference */
    private calibratedTorsoLength = 0.2;

    reset(): void {
        super.reset();
        this.angleHistory = [];
        this.shoulderYHistory = [];
        this.minAngleThisRep = 180;
        this.maxRiseThisRep = 0;
        this.bestAlignmentThisRep = 0;
        this.hasReachedValidDown = false;
        this.lastRepTimestamp = 0;
        this.prevHipY = null;
        this.maxHipVelocity = 0;
        this.worstArmAsymmetry = 0;
        this.worstBodySway = 0;
        this.wasAscending = false;
        this.calibrationFrames = [];
        this.calibratedMinShoulderHipSpread = MIN_SHOULDER_HIP_SPREAD;
        this.calibratedWristAboveShoulderMargin = WRIST_ABOVE_SHOULDER_MARGIN;
        this.calibratedBaselineShoulderY = 0;
        this.calibratedTorsoLength = 0.2;
    }

    processPose(landmarks: Landmark[]): ExerciseState {
        if (!landmarks || landmarks.length < 25) return this.getState();

        const leftShoulder = landmarks[LM.LEFT_SHOULDER];
        const rightShoulder = landmarks[LM.RIGHT_SHOULDER];
        const leftElbow = landmarks[LM.LEFT_ELBOW];
        const rightElbow = landmarks[LM.RIGHT_ELBOW];
        const leftWrist = landmarks[LM.LEFT_WRIST];
        const rightWrist = landmarks[LM.RIGHT_WRIST];
        const leftHip = landmarks[LM.LEFT_HIP];
        const rightHip = landmarks[LM.RIGHT_HIP];

        // ── 1. Compute smoothed elbow angle ─────────────────────────
        const leftElbowAngle = this.computeAngle(leftShoulder, leftElbow, leftWrist);
        const rightElbowAngle = this.computeAngle(rightShoulder, rightElbow, rightWrist);

        const leftVis = (leftElbow.visibility ?? 0) + (leftWrist.visibility ?? 0);
        const rightVis = (rightElbow.visibility ?? 0) + (rightWrist.visibility ?? 0);

        let elbowAngle: number;
        if (leftVis > rightVis) {
            elbowAngle = leftElbowAngle;
        } else if (rightVis > leftVis) {
            elbowAngle = rightElbowAngle;
        } else {
            elbowAngle = (leftElbowAngle + rightElbowAngle) / 2;
        }

        this.angleHistory.push(elbowAngle);
        if (this.angleHistory.length > SMOOTHING_WINDOW) this.angleHistory.shift();
        const smoothedAngle =
            this.angleHistory.reduce((s, v) => s + v, 0) / this.angleHistory.length;

        // ── 2. Shoulder vertical position (smoothed) ─────────────────
        const midShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
        const midHipY = (leftHip.y + rightHip.y) / 2;
        const midWristY = (leftWrist.y + rightWrist.y) / 2;

        this.shoulderYHistory.push(midShoulderY);
        if (this.shoulderYHistory.length > SMOOTHING_WINDOW) this.shoulderYHistory.shift();
        const smoothedShoulderY =
            this.shoulderYHistory.reduce((s, v) => s + v, 0) / this.shoulderYHistory.length;

        const shoulderHipSpread = Math.abs(midShoulderY - midHipY);
        const wristOffset = midWristY - midShoulderY;

        // How much the shoulders have risen from baseline (positive = higher)
        // Remember: Y decreases upward in normalised coords
        const shoulderRise = this.calibratedBaselineShoulderY - smoothedShoulderY;
        const riseFraction = this.calibratedTorsoLength > 0
            ? shoulderRise / this.calibratedTorsoLength
            : 0;

        // ── Kipping: track hip Y velocity ──
        let hipVelocity = 0;
        if (this.prevHipY !== null) {
            hipVelocity = Math.abs(midHipY - this.prevHipY);
        }
        this.prevHipY = midHipY;

        // ── 3. Calibration (dead hang) ───────────────────────────────
        if (!this.state.isCalibrated) {
            const isRoughlyHanging =
                shoulderHipSpread > MIN_SHOULDER_HIP_SPREAD &&
                wristOffset < WRIST_ABOVE_SHOULDER_MARGIN &&
                smoothedAngle > ELBOW_CONFIRM_DOWN;

            if (isRoughlyHanging) {
                this.calibrationFrames.push({
                    spread: shoulderHipSpread,
                    wristOffset,
                    shoulderY: midShoulderY,
                });
                this.state.calibratingPercentage = Math.min(
                    100,
                    Math.round((this.calibrationFrames.length / CALIBRATION_FRAMES_REQUIRED) * 100),
                );

                if (this.calibrationFrames.length >= CALIBRATION_FRAMES_REQUIRED) {
                    const n = this.calibrationFrames.length;
                    const avgSpread = this.calibrationFrames.reduce((s, f) => s + f.spread, 0) / n;
                    const avgWrist = this.calibrationFrames.reduce((s, f) => s + f.wristOffset, 0) / n;
                    const avgShoulderY = this.calibrationFrames.reduce((s, f) => s + f.shoulderY, 0) / n;

                    this.calibratedMinShoulderHipSpread = avgSpread * 0.3;
                    this.calibratedWristAboveShoulderMargin = avgWrist + 0.25;
                    this.calibratedBaselineShoulderY = avgShoulderY;
                    this.calibratedTorsoLength = avgSpread; // shoulder-hip distance ≈ torso

                    this.state.isCalibrated = true;
                    this.state.isValidPosition = true;
                }
            } else {
                this.calibrationFrames = [];
                this.state.calibratingPercentage = 0;
                this.state.isValidPosition = false;
            }

            return this.getState();
        }

        // Ensure key landmarks are actually visible
        const keyLandmarksVisible = this.areLandmarksVisible(
            landmarks,
            [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_ELBOW, LM.RIGHT_ELBOW, LM.LEFT_HIP, LM.RIGHT_HIP],
            0.4,
        );

        const isBodyVisible = shoulderHipSpread > this.calibratedMinShoulderHipSpread;
        const areWristsAboveShoulder = wristOffset < this.calibratedWristAboveShoulderMargin;
        const isValidPullUpPosition = keyLandmarksVisible && isBodyVisible && areWristsAboveShoulder;

        // ── 4. Alignment metrics ─────────────────────────────────────
        const armAsymmetry = Math.abs(leftElbowAngle - rightElbowAngle);
        const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
        const hipMidX = (leftHip.x + rightHip.x) / 2;
        const bodySway = Math.abs(shoulderMidX - hipMidX);

        const alignmentScore = this.computePullUpAlignmentScore(armAsymmetry, bodySway, hipVelocity);

        this.state.isValidPosition = isValidPullUpPosition;

        // ── 5. State machine (shoulder rise + elbow confirmation) ────
        const prevPhase = this.state.currentPhase;
        this.state.incompleteRepFeedback = null;

        // UP: body has risen enough AND elbows are bent enough
        const isUp = riseFraction >= RISE_UP_FRACTION && smoothedAngle <= ELBOW_CONFIRM_UP;
        // DOWN: body is back near baseline AND arms are relatively extended
        const isDown = riseFraction <= RISE_DOWN_FRACTION && smoothedAngle >= ELBOW_CONFIRM_DOWN;

        if (isUp) {
            if (this.hasReachedValidDown) {
                const repAmplitudeScore = this.computeAmplitudeScore(this.maxRiseThisRep);
                const repAlignmentScore = this.bestAlignmentThisRep;
                const repScore = Math.round(repAmplitudeScore * 0.6 + repAlignmentScore * 0.4);

                const now = Date.now();
                const repDuration = this.lastRepTimestamp > 0 ? now - this.lastRepTimestamp : 3000;
                const feedback = this.determineFeedback(
                    repAmplitudeScore, repAlignmentScore,
                    this.worstArmAsymmetry, this.worstBodySway,
                    this.maxHipVelocity, repDuration,
                );
                this.lastRepTimestamp = now;

                this.recordRep(repScore, repAmplitudeScore, repAlignmentScore, this.minAngleThisRep, feedback);

                this.minAngleThisRep = 180;
                this.maxRiseThisRep = 0;
                this.bestAlignmentThisRep = 0;
                this.hasReachedValidDown = false;
                this.maxHipVelocity = 0;
                this.worstArmAsymmetry = 0;
                this.worstBodySway = 0;
            }
            this.state.currentPhase = 'up';

        } else if (isDown) {
            // Detect incomplete rep: user was ascending but came back down
            if (this.wasAscending && this.maxRiseThisRep > 0.1 && this.maxRiseThisRep < RISE_UP_FRACTION) {
                this.state.incompleteRepFeedback = 'go_lower'; // "pull higher"
            }
            this.wasAscending = false;

            if (isValidPullUpPosition) {
                this.hasReachedValidDown = true;
            } else {
                this.hasReachedValidDown = false;
            }
            this.state.currentPhase = 'down';

        } else {
            // Transition zone
            if (prevPhase === 'down') {
                this.wasAscending = true;
            }
            this.state.currentPhase = 'transition';
        }

        // ── 6. Track stats during active rep ────────────────────────
        if (prevPhase !== 'idle') {
            if (riseFraction > this.maxRiseThisRep) {
                this.maxRiseThisRep = riseFraction;
            }
            if (smoothedAngle < this.minAngleThisRep) {
                this.minAngleThisRep = smoothedAngle;
            }
            if (alignmentScore > this.bestAlignmentThisRep) {
                this.bestAlignmentThisRep = alignmentScore;
            }
            if (hipVelocity > this.maxHipVelocity) {
                this.maxHipVelocity = hipVelocity;
            }
            if (armAsymmetry > this.worstArmAsymmetry) {
                this.worstArmAsymmetry = armAsymmetry;
            }
            if (bodySway > this.worstBodySway) {
                this.worstBodySway = bodySway;
            }
        }

        return this.getState();
    }

    /** Amplitude score based on how high the shoulders rose (fraction of torso). */
    private computeAmplitudeScore(maxRise: number): number {
        if (maxRise >= PERFECT_RISE_FRACTION) return 100;
        if (maxRise <= RISE_UP_FRACTION) return 50; // minimum passing score
        const score = 50 + ((maxRise - RISE_UP_FRACTION) / (PERFECT_RISE_FRACTION - RISE_UP_FRACTION)) * 50;
        return Math.round(Math.max(0, Math.min(100, score)));
    }

    /**
     * Pull-up alignment:
     * 1. Arm symmetry: left vs right elbow angle difference
     * 2. Body sway: shoulder-hip horizontal offset
     * 3. Kipping penalty: excessive hip velocity
     */
    private computePullUpAlignmentScore(
        armAsymmetry: number,
        bodySway: number,
        hipVelocity: number,
    ): number {
        const symScore = armAsymmetry <= ARM_SYMMETRY_TOLERANCE
            ? 100
            : Math.max(0, 100 - ((armAsymmetry - ARM_SYMMETRY_TOLERANCE) / 30) * 100);

        const swayScore = bodySway <= BODY_SWAY_TOLERANCE
            ? 100
            : Math.max(0, 100 - ((bodySway - BODY_SWAY_TOLERANCE) / 0.08) * 100);

        const kipScore = hipVelocity <= KIPPING_VELOCITY_THRESHOLD
            ? 100
            : Math.max(0, 100 - ((hipVelocity - KIPPING_VELOCITY_THRESHOLD) / 0.035) * 100);

        return Math.min(100, Math.round(symScore * 0.35 + swayScore * 0.30 + kipScore * 0.35));
    }

    /**
     * Determine the most important feedback for this rep.
     */
    private determineFeedback(
        amplitudeScore: number,
        alignmentScore: number,
        worstArmAsym: number,
        worstBodySway: number,
        maxHipVel: number,
        repDurationMs: number,
    ): RepFeedback {
        if (amplitudeScore >= 90 && alignmentScore >= 85) return 'perfect';
        if (amplitudeScore < 60) return 'go_lower';
        if (maxHipVel > KIPPING_VELOCITY_THRESHOLD * 2) return 'kipping';
        if (worstBodySway > BODY_SWAY_TOLERANCE * 2) return 'body_sway';
        if (worstArmAsym > ARM_SYMMETRY_TOLERANCE * 2) return 'arms_uneven';
        if (repDurationMs < 1000 && repDurationMs > 0) return 'too_fast';
        return 'good';
    }
}
