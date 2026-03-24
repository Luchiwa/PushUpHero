import { BaseExerciseDetector } from '../BaseExerciseDetector';
import type { ExerciseState, Landmark } from '../types';
import { CALIBRATION_FRAMES_REQUIRED } from '@lib/constants';

/**
 * PullUpDetector — Detects pull-up reps from a camera placed below the user
 * (front or back), looking upward.
 *
 * Key joint: **elbow angle** (shoulder → elbow → wrist).
 *   - DOWN (dead hang): arms extended, elbow angle ~150-170°
 *   - UP (chin above bar): arms bent, elbow angle ~40-80°
 *
 * Camera below means:
 *   - Body appears roughly vertical in frame
 *   - Wrists are ABOVE shoulders (lower Y value) in hang position
 *   - During the pull, the whole body rises so shoulder Y decreases
 *
 * Anti-cheat:
 *   - Wrists must stay above or near shoulder height (wristY < shoulderY + margin)
 *   - Body must be roughly vertical (shoulder-hip spread significant)
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

// ── Elbow angle thresholds ────────────────────────────────────────
/** Elbow angle BELOW which the position is considered "UP" (arms fully bent, chin above bar) */
const ANGLE_UP_THRESHOLD = 80;
/** Elbow angle ABOVE which the position is considered "DOWN" (arms extended, dead hang) */
const ANGLE_DOWN_THRESHOLD = 140;
/** Perfect amplitude — angle ≤ this gives full amplitude score */
const PERFECT_AMPLITUDE_ANGLE = 50;
/** Smoothing window for angle signal */
const SMOOTHING_WINDOW = 5;

// ── Positional constraints ───────────────────────────────────────
/**
 * Minimum vertical spread between shoulders and hips (normalised 0–1).
 * In a hanging position with camera below: spread is moderate (~0.15–0.40).
 * If only upper body is visible the spread is small but non-zero.
 */
const MIN_SHOULDER_HIP_SPREAD = 0.08;

/**
 * Wrists must be ABOVE shoulders (lower Y) or within a margin.
 * In a hang/pull: wrists grip the bar → wrist.y ≤ shoulder.y.
 * A positive margin means we tolerate wrists slightly below shoulders
 * (camera angle can distort this).
 */
const WRIST_ABOVE_SHOULDER_MARGIN = 0.15;

export class PullUpDetector extends BaseExerciseDetector {
    private angleHistory: number[] = [];
    private minAngleThisRep: number = 180;
    private bestAlignmentThisRep: number = 100;
    private hasReachedValidDown = false;

    // ── Calibration State ──
    private calibrationFrames: { spread: number; wristOffset: number }[] = [];
    private calibratedMinShoulderHipSpread = MIN_SHOULDER_HIP_SPREAD;
    private calibratedWristAboveShoulderMargin = WRIST_ABOVE_SHOULDER_MARGIN;

    reset(): void {
        super.reset();
        this.angleHistory = [];
        this.minAngleThisRep = 180;
        this.bestAlignmentThisRep = 100;
        this.hasReachedValidDown = false;
        this.calibrationFrames = [];
        this.calibratedMinShoulderHipSpread = MIN_SHOULDER_HIP_SPREAD;
        this.calibratedWristAboveShoulderMargin = WRIST_ABOVE_SHOULDER_MARGIN;
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

        // ── 2. Positional validity & Calibration ─────────────────────
        const midShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
        const midHipY = (leftHip.y + rightHip.y) / 2;
        const midWristY = (leftWrist.y + rightWrist.y) / 2;

        const shoulderHipSpread = Math.abs(midShoulderY - midHipY);
        // Positive when wrists are below shoulders (bad for pull-up)
        const wristOffset = midWristY - midShoulderY;

        // ── 2.5 Calibration logic ──
        if (!this.state.isCalibrated) {
            // Rough hang position: body visible, wrists above or near shoulders,
            // arms mostly extended (angle > ANGLE_DOWN_THRESHOLD - slack)
            const isRoughlyHanging =
                shoulderHipSpread > MIN_SHOULDER_HIP_SPREAD &&
                wristOffset < WRIST_ABOVE_SHOULDER_MARGIN &&
                smoothedAngle > ANGLE_DOWN_THRESHOLD - 20;

            if (isRoughlyHanging) {
                this.calibrationFrames.push({ spread: shoulderHipSpread, wristOffset });
                this.state.calibratingPercentage = Math.min(
                    100,
                    Math.round((this.calibrationFrames.length / CALIBRATION_FRAMES_REQUIRED) * 100),
                );

                if (this.calibrationFrames.length >= CALIBRATION_FRAMES_REQUIRED) {
                    const avgSpread =
                        this.calibrationFrames.reduce((s, f) => s + f.spread, 0) /
                        this.calibrationFrames.length;
                    const avgWrist =
                        this.calibrationFrames.reduce((s, f) => s + f.wristOffset, 0) /
                        this.calibrationFrames.length;

                    // Personalized thresholds with slack
                    this.calibratedMinShoulderHipSpread = avgSpread * 0.3;
                    this.calibratedWristAboveShoulderMargin = avgWrist + 0.25;

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

        // Calibrated validity checks
        const isBodyVisible = shoulderHipSpread > this.calibratedMinShoulderHipSpread;
        const areWristsAboveShoulder = wristOffset < this.calibratedWristAboveShoulderMargin;
        const isValidPullUpPosition = isBodyVisible && areWristsAboveShoulder;

        // ── 3. Alignment score ───────────────────────────────────────
        // For pull-ups: how symmetrical are the arms (left vs right elbow angle).
        // Also measure shoulder horizontal alignment for body sway.
        const alignmentScore = this.computePullUpAlignmentScore(
            leftShoulder, rightShoulder,
            leftElbowAngle, rightElbowAngle,
            leftHip, rightHip,
        );

        this.state.isValidPosition = isValidPullUpPosition;

        // ── 4. State machine ─────────────────────────────────────────
        // Pull-up: DOWN = arms extended (high angle), UP = arms bent (low angle)
        // This is the INVERSE of push-ups!
        const prevPhase = this.state.currentPhase;

        if (smoothedAngle <= ANGLE_UP_THRESHOLD) {
            // UP phase (arms bent, chin at bar) — if we had a valid DOWN, count rep
            if (this.hasReachedValidDown) {
                const repAmplitudeScore = this.computeAmplitudeScore(this.minAngleThisRep);
                const repAlignmentScore = this.bestAlignmentThisRep;
                const repScore = Math.round(repAmplitudeScore * 0.6 + repAlignmentScore * 0.4);
                this.recordRep(repScore, repAmplitudeScore, repAlignmentScore, this.minAngleThisRep);

                this.minAngleThisRep = 180;
                this.bestAlignmentThisRep = 100;
                this.hasReachedValidDown = false;
            }
            this.state.currentPhase = 'up';

        } else if (smoothedAngle >= ANGLE_DOWN_THRESHOLD) {
            // DOWN phase (dead hang) — require valid position
            if (isValidPullUpPosition) {
                this.hasReachedValidDown = true;
            } else {
                this.hasReachedValidDown = false;
            }
            this.state.currentPhase = 'down';

        } else {
            this.state.currentPhase = 'transition';
        }

        // ── 5. Track stats during active rep ────────────────────────
        if (prevPhase !== 'idle') {
            if (smoothedAngle < this.minAngleThisRep) {
                this.minAngleThisRep = smoothedAngle;
            }
            if (alignmentScore > this.bestAlignmentThisRep) {
                this.bestAlignmentThisRep = alignmentScore;
            }
        }

        return this.getState();
    }

    private computeAmplitudeScore(minAngle: number): number {
        if (minAngle <= PERFECT_AMPLITUDE_ANGLE) return 100;
        if (minAngle >= ANGLE_UP_THRESHOLD) return 0;
        const score =
            ((ANGLE_UP_THRESHOLD - minAngle) / (ANGLE_UP_THRESHOLD - PERFECT_AMPLITUDE_ANGLE)) * 100;
        return Math.round(Math.max(0, Math.min(100, score)));
    }

    /**
     * Pull-up alignment: measures arm symmetry + body sway.
     * - Arm symmetry: difference between left and right elbow angles
     * - Body sway: horizontal deviation of hip midpoint from shoulder midpoint
     */
    private computePullUpAlignmentScore(
        leftShoulder: Landmark, rightShoulder: Landmark,
        leftElbowAngle: number, rightElbowAngle: number,
        leftHip: Landmark, rightHip: Landmark,
    ): number {
        // Arm symmetry: |left - right| angle difference
        const angleDiff = Math.abs(leftElbowAngle - rightElbowAngle);
        const symmetryScore = Math.max(0, 100 - (angleDiff / 30) * 100);

        // Body sway: horizontal offset between shoulder and hip midpoints
        const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
        const hipMidX = (leftHip.x + rightHip.x) / 2;
        const swayDeviation = Math.abs(shoulderMidX - hipMidX);
        const swayScore = Math.max(0, 100 - (swayDeviation / 0.08) * 100);

        return Math.min(100, Math.round(symmetryScore * 0.5 + swayScore * 0.5));
    }
}
