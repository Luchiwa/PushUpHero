import { BaseExerciseDetector } from '../BaseExerciseDetector';
import type { ExerciseState, Landmark, RepFeedback } from '../types';
import { CALIBRATION_FRAMES_REQUIRED } from '@lib/constants';

/**
 * MediaPipe Pose landmark indices (33-point model).
 * Reference: https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
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
    LEFT_ANKLE: 27,
    RIGHT_ANKLE: 28,
} as const;

// ── Elbow angle thresholds ────────────────────────────────────────
/** Elbow angle above which the position is considered "UP" (arms straight). */
const ANGLE_UP_THRESHOLD = 155;
/** Elbow angle below which the position is considered "DOWN" (arms bent).
 *  Desktop webcams see shallower angles (~136-145°), mobile sees deeper (~61-93°). */
const ANGLE_DOWN_THRESHOLD = 140;
/** Perfect amplitude target — angle ≤ this gives full amplitude score */
const PERFECT_AMPLITUDE_ANGLE = 80;
/** Number of frames to smooth the angle signal */
const SMOOTHING_WINDOW = 5;

// ── Anti-cheat positional constraints ────────────────────────────
const MAX_BODY_VERTICAL_SPREAD = 0.65;
const WRIST_BELOW_SHOULDER_MARGIN = -0.15;

// ── Alignment thresholds (front-facing camera) ───────────────────
/** Max elbow angle difference (L vs R) before penalising arm symmetry */
const ARM_SYMMETRY_TOLERANCE = 15; // degrees
/** Hip sag/pike: deviation of hip Y from shoulder-ankle midline (normalised) */
const HIP_DEVIATION_TOLERANCE = 0.04;

export class PushUpDetector extends BaseExerciseDetector {
    private angleHistory: number[] = [];
    private minAngleThisRep: number = 180;
    private bestAlignmentThisRep: number = 0; // FIX: was 100, never updated
    private hasReachedValidDown = false;
    private lastRepTimestamp: number = 0;

    // Alignment tracking across frames within a rep
    private worstHipDeviation: number = 0;
    private worstArmAsymmetry: number = 0;

    // Track whether user was descending (to detect incomplete reps)
    private wasDescending: boolean = false;

    // ── Calibration State ──
    private calibrationFrames: { spread: number, wristOffset: number }[] = [];
    private calibratedMaxBodyVerticalSpread = MAX_BODY_VERTICAL_SPREAD;
    private calibratedWristBelowShoulderMargin = WRIST_BELOW_SHOULDER_MARGIN;

    reset(): void {
        super.reset();
        this.angleHistory = [];
        this.minAngleThisRep = 180;
        this.bestAlignmentThisRep = 0;
        this.hasReachedValidDown = false;
        this.lastRepTimestamp = 0;
        this.worstHipDeviation = 0;
        this.worstArmAsymmetry = 0;
        this.wasDescending = false;
        this.calibrationFrames = [];
        this.calibratedMaxBodyVerticalSpread = MAX_BODY_VERTICAL_SPREAD;
        this.calibratedWristBelowShoulderMargin = WRIST_BELOW_SHOULDER_MARGIN;
    }

    processPose(landmarks: Landmark[]): ExerciseState {
        if (!landmarks || landmarks.length < 29) return this.getState();

        const leftShoulder = landmarks[LM.LEFT_SHOULDER];
        const rightShoulder = landmarks[LM.RIGHT_SHOULDER];
        const leftElbow = landmarks[LM.LEFT_ELBOW];
        const rightElbow = landmarks[LM.RIGHT_ELBOW];
        const leftWrist = landmarks[LM.LEFT_WRIST];
        const rightWrist = landmarks[LM.RIGHT_WRIST];
        const leftHip = landmarks[LM.LEFT_HIP];
        const rightHip = landmarks[LM.RIGHT_HIP];
        const leftAnkle = landmarks[LM.LEFT_ANKLE];
        const rightAnkle = landmarks[LM.RIGHT_ANKLE];

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

        // ── 2. Positional validity checks & Calibration ─────────────
        const midShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
        const midAnkleY = (leftAnkle.y + rightAnkle.y) / 2;
        const midWristY = (leftWrist.y + rightWrist.y) / 2;

        const bodyVerticalSpread = Math.abs(midShoulderY - midAnkleY);
        const wristOffset = midShoulderY - midWristY;

        if (!this.state.isCalibrated) {
            const isRoughlyPlank = bodyVerticalSpread < MAX_BODY_VERTICAL_SPREAD && wristOffset < WRIST_BELOW_SHOULDER_MARGIN;

            if (isRoughlyPlank) {
                this.calibrationFrames.push({ spread: bodyVerticalSpread, wristOffset });
                this.state.calibratingPercentage = Math.min(100, Math.round((this.calibrationFrames.length / CALIBRATION_FRAMES_REQUIRED) * 100));

                if (this.calibrationFrames.length >= CALIBRATION_FRAMES_REQUIRED) {
                    const avgSpread = this.calibrationFrames.reduce((s, f) => s + f.spread, 0) / this.calibrationFrames.length;
                    const avgWrist = this.calibrationFrames.reduce((s, f) => s + f.wristOffset, 0) / this.calibrationFrames.length;

                    this.calibratedMaxBodyVerticalSpread = avgSpread + 0.30;
                    this.calibratedWristBelowShoulderMargin = avgWrist + 0.15;

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

        // Ensure key landmarks are actually visible (not hallucinated off-screen)
        const keyLandmarksVisible = this.areLandmarksVisible(
            landmarks,
            [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_ELBOW, LM.RIGHT_ELBOW, LM.LEFT_HIP, LM.RIGHT_HIP],
            0.4,
        );

        const isBodyHorizontal = bodyVerticalSpread < this.calibratedMaxBodyVerticalSpread;
        const areWristsBelowShoulders = wristOffset < this.calibratedWristBelowShoulderMargin;
        const isValidPushUpPosition = keyLandmarksVisible && isBodyHorizontal && areWristsBelowShoulders;

        // ── 3. Alignment metrics (computed every frame, tracked per rep) ──
        const armAsymmetry = Math.abs(leftElbowAngle - rightElbowAngle);

        // Hip deviation from shoulder-ankle line (vertical axis)
        const midHipY = (leftHip.y + rightHip.y) / 2;
        const expectedHipY = (midShoulderY + midAnkleY) / 2;
        const hipDeviation = midHipY - expectedHipY; // positive = sagging, negative = piking

        const alignmentScore = this.computeAlignmentScore(armAsymmetry, hipDeviation);

        this.state.isValidPosition = isValidPushUpPosition;

        // ── 4. State machine ─────────────────────────────────────────
        const prevPhase = this.state.currentPhase;
        this.state.incompleteRepFeedback = null; // clear each frame

        if (smoothedAngle >= ANGLE_UP_THRESHOLD) {
            // Detect incomplete rep: user was descending but came back up
            // without reaching ANGLE_DOWN_THRESHOLD
            if (this.wasDescending && !this.hasReachedValidDown && this.minAngleThisRep < 170) {
                this.state.incompleteRepFeedback = 'go_lower';
            }
            this.wasDescending = false;

            if (this.hasReachedValidDown) {
                const repAmplitudeScore = this.computeAmplitudeScore(this.minAngleThisRep);

                // Use worst alignment seen during this rep (not best — we penalise bad form)
                const repAlignmentScore = this.bestAlignmentThisRep;

                const repScore = Math.round(repAmplitudeScore * 0.6 + repAlignmentScore * 0.4);

                // Determine feedback
                const now = Date.now();
                const repDuration = this.lastRepTimestamp > 0 ? now - this.lastRepTimestamp : 2000;
                const feedback = this.determineFeedback(
                    repAmplitudeScore, repAlignmentScore,
                    this.worstHipDeviation, this.worstArmAsymmetry,
                    repDuration,
                );
                this.lastRepTimestamp = now;

                this.recordRep(repScore, repAmplitudeScore, repAlignmentScore, this.minAngleThisRep, feedback);

                // Reset for next rep
                this.minAngleThisRep = 180;
                this.bestAlignmentThisRep = 0;
                this.hasReachedValidDown = false;
                this.worstHipDeviation = 0;
                this.worstArmAsymmetry = 0;
            }
            this.state.currentPhase = 'up';

        } else if (smoothedAngle <= ANGLE_DOWN_THRESHOLD) {
            if (isBodyHorizontal) {
                this.hasReachedValidDown = true;
            } else {
                this.hasReachedValidDown = false;
            }
            this.wasDescending = true;
            this.state.currentPhase = 'down';
        } else {
            // In transition zone — mark as descending if angle is decreasing
            if (prevPhase === 'up' || prevPhase === 'idle') {
                this.wasDescending = true;
            }
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
            // Track worst deviations for feedback
            if (Math.abs(hipDeviation) > Math.abs(this.worstHipDeviation)) {
                this.worstHipDeviation = hipDeviation;
            }
            if (armAsymmetry > this.worstArmAsymmetry) {
                this.worstArmAsymmetry = armAsymmetry;
            }
        }

        return this.getState();
    }

    private computeAmplitudeScore(minAngle: number): number {
        if (minAngle <= PERFECT_AMPLITUDE_ANGLE) return 100;
        if (minAngle >= ANGLE_DOWN_THRESHOLD) return 0;
        const score =
            ((ANGLE_DOWN_THRESHOLD - minAngle) / (ANGLE_DOWN_THRESHOLD - PERFECT_AMPLITUDE_ANGLE)) * 100;
        return Math.round(Math.max(0, Math.min(100, score)));
    }

    /**
     * Alignment score for front-facing push-ups:
     * 1. Arm symmetry: penalise if one arm bends more than the other
     * 2. Hip line: penalise sagging (positive deviation) or piking (negative)
     */
    private computeAlignmentScore(armAsymmetry: number, hipDeviation: number): number {
        // Arm symmetry: 0-15° diff → 100, 15-45° → linear decay to 0
        const symScore = armAsymmetry <= ARM_SYMMETRY_TOLERANCE
            ? 100
            : Math.max(0, 100 - ((armAsymmetry - ARM_SYMMETRY_TOLERANCE) / 30) * 100);

        // Hip line: 0-0.04 deviation → 100, 0.04-0.12 → linear decay to 0
        const absHipDev = Math.abs(hipDeviation);
        const hipScore = absHipDev <= HIP_DEVIATION_TOLERANCE
            ? 100
            : Math.max(0, 100 - ((absHipDev - HIP_DEVIATION_TOLERANCE) / 0.08) * 100);

        return Math.min(100, Math.round(symScore * 0.5 + hipScore * 0.5));
    }

    /**
     * Determine the single most important feedback for this rep.
     * Priority: amplitude > hip sag/pike > arm asymmetry > speed > good/perfect
     */
    private determineFeedback(
        amplitudeScore: number,
        alignmentScore: number,
        worstHipDev: number,
        worstArmAsym: number,
        repDurationMs: number,
    ): RepFeedback {
        // Perfect rep
        if (amplitudeScore >= 90 && alignmentScore >= 85) return 'perfect';

        // Amplitude is the #1 issue
        if (amplitudeScore < 60) return 'go_lower';

        // Hip issues
        if (worstHipDev > HIP_DEVIATION_TOLERANCE * 2) return 'body_sagging';
        if (worstHipDev < -HIP_DEVIATION_TOLERANCE * 2) return 'body_piking';

        // Arm symmetry
        if (worstArmAsym > ARM_SYMMETRY_TOLERANCE * 2) return 'arms_uneven';

        // Too fast (less than 800ms per rep)
        if (repDurationMs < 800 && repDurationMs > 0) return 'too_fast';

        return 'good';
    }
}
