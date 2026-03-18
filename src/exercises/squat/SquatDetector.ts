import { BaseExerciseDetector } from '../BaseExerciseDetector';
import type { ExerciseState, Landmark } from '../types';
import { CALIBRATION_FRAMES_REQUIRED } from '@lib/constants';

/**
 * MediaPipe Pose landmark indices used for squat detection.
 * User faces the camera standing upright.
 */
const LM = {
    LEFT_SHOULDER: 11,
    RIGHT_SHOULDER: 12,
    LEFT_HIP: 23,
    RIGHT_HIP: 24,
    LEFT_KNEE: 25,
    RIGHT_KNEE: 26,
    LEFT_ANKLE: 27,
    RIGHT_ANKLE: 28,
} as const;

// ── Knee angle thresholds ─────────────────────────────────────────
/**
 * Knee angle above which the position is considered "UP" (legs straight).
 * Standing: ~170-180°. We use 160° as threshold.
 */
const ANGLE_UP_THRESHOLD = 160;
/**
 * Knee angle below which the position is considered "DOWN" (deep squat).
 * Deep squat target: ≤90°. We use 110° as the threshold to enter DOWN phase.
 */
const ANGLE_DOWN_THRESHOLD = 110;
/** Perfect amplitude target — knee angle ≤ this gives full amplitude score */
const PERFECT_AMPLITUDE_ANGLE = 80;
/** Number of frames to smooth the angle signal */
const SMOOTHING_WINDOW = 5;

// ── Positional constraints ───────────────────────────────────────
/**
 * Minimum vertical spread between shoulder and ankle (normalized 0–1).
 * Standing facing camera: spread is large (~0.45–0.75).
 * If only upper body is visible, spread is tiny.
 */
const MIN_BODY_VERTICAL_SPREAD = 0.35;

/**
 * Shoulders must be ABOVE (lower Y value) the hips.
 * This ensures the user is upright, not lying down.
 */
const SHOULDER_ABOVE_HIP_MARGIN = 0.04;

/**
 * Minimum visibility score for key lower-body landmarks.
 * MediaPipe returns low visibility when limbs are off-screen or occluded.
 */
const MIN_LANDMARK_VISIBILITY = 0.5;

export class SquatDetector extends BaseExerciseDetector {
    private angleHistory: number[] = [];
    private minAngleThisRep: number = 180;
    private bestAlignmentThisRep: number = 100;
    private hasReachedValidDown = false;

    // ── Calibration State ──
    private calibrationFrames: { spread: number; shoulderHipDiff: number }[] = [];

    // Calibrated personalized thresholds
    private calibratedMinBodyVerticalSpread = MIN_BODY_VERTICAL_SPREAD;
    private calibratedShoulderAboveHipMargin = SHOULDER_ABOVE_HIP_MARGIN;

    reset(): void {
        super.reset();
        this.angleHistory = [];
        this.minAngleThisRep = 180;
        this.bestAlignmentThisRep = 100;
        this.hasReachedValidDown = false;
        this.calibrationFrames = [];
        this.calibratedMinBodyVerticalSpread = MIN_BODY_VERTICAL_SPREAD;
        this.calibratedShoulderAboveHipMargin = SHOULDER_ABOVE_HIP_MARGIN;
    }

    processPose(landmarks: Landmark[]): ExerciseState {
        if (!landmarks || landmarks.length < 29) return this.getState();

        const leftShoulder = landmarks[LM.LEFT_SHOULDER];
        const rightShoulder = landmarks[LM.RIGHT_SHOULDER];
        const leftHip = landmarks[LM.LEFT_HIP];
        const rightHip = landmarks[LM.RIGHT_HIP];
        const leftKnee = landmarks[LM.LEFT_KNEE];
        const rightKnee = landmarks[LM.RIGHT_KNEE];
        const leftAnkle = landmarks[LM.LEFT_ANKLE];
        const rightAnkle = landmarks[LM.RIGHT_ANKLE];

        // ── 1. Compute smoothed knee angle ──────────────────────────
        // Knee angle = angle at the knee joint (hip → knee → ankle)
        const leftKneeAngle = this.computeAngle(leftHip, leftKnee, leftAnkle);
        const rightKneeAngle = this.computeAngle(rightHip, rightKnee, rightAnkle);

        const leftVis = (leftKnee.visibility ?? 0) + (leftAnkle.visibility ?? 0);
        const rightVis = (rightKnee.visibility ?? 0) + (rightAnkle.visibility ?? 0);

        let kneeAngle: number;
        if (leftVis > rightVis) {
            kneeAngle = leftKneeAngle;
        } else if (rightVis > leftVis) {
            kneeAngle = rightKneeAngle;
        } else {
            kneeAngle = (leftKneeAngle + rightKneeAngle) / 2;
        }

        this.angleHistory.push(kneeAngle);
        if (this.angleHistory.length > SMOOTHING_WINDOW) this.angleHistory.shift();
        const smoothedAngle =
            this.angleHistory.reduce((s, v) => s + v, 0) / this.angleHistory.length;

        // ── 2. Positional validity checks & Calibration ─────────────
        const midShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
        const midHipY = (leftHip.y + rightHip.y) / 2;
        const midAnkleY = (leftAnkle.y + rightAnkle.y) / 2;

        const bodyVerticalSpread = Math.abs(midShoulderY - midAnkleY);
        const shoulderHipDiff = midHipY - midShoulderY; // positive = shoulders above hips (correct)

        // ── 2.5 Calibration logic ──
        if (!this.state.isCalibrated) {
            // Require key lower-body landmarks to actually be visible
            const kneeVis = Math.max(leftKnee.visibility ?? 0, rightKnee.visibility ?? 0);
            const ankleVis = Math.max(leftAnkle.visibility ?? 0, rightAnkle.visibility ?? 0);
            const areLowerLandmarksVisible =
                kneeVis > MIN_LANDMARK_VISIBILITY && ankleVis > MIN_LANDMARK_VISIBILITY;

            // Verify vertical ordering: shoulders above hips above knees above ankles
            const midKneeY = (leftKnee.y + rightKnee.y) / 2;
            const isVerticallyOrdered =
                midShoulderY < midHipY && midHipY < midKneeY && midKneeY < midAnkleY;

            // Check if the user is roughly standing upright with full body visible
            const isRoughlyStanding =
                areLowerLandmarksVisible &&
                isVerticallyOrdered &&
                bodyVerticalSpread > MIN_BODY_VERTICAL_SPREAD &&
                shoulderHipDiff > SHOULDER_ABOVE_HIP_MARGIN &&
                smoothedAngle > ANGLE_UP_THRESHOLD; // legs should be straight during calibration

            if (isRoughlyStanding) {
                this.calibrationFrames.push({ spread: bodyVerticalSpread, shoulderHipDiff });
                this.state.calibratingPercentage = Math.min(
                    100,
                    Math.round((this.calibrationFrames.length / CALIBRATION_FRAMES_REQUIRED) * 100),
                );

                if (this.calibrationFrames.length >= CALIBRATION_FRAMES_REQUIRED) {
                    const avgSpread =
                        this.calibrationFrames.reduce((s, f) => s + f.spread, 0) /
                        this.calibrationFrames.length;
                    const avgShoulderHipDiff =
                        this.calibrationFrames.reduce((s, f) => s + f.shoulderHipDiff, 0) /
                        this.calibrationFrames.length;

                    // Personalized thresholds with extra slack
                    this.calibratedMinBodyVerticalSpread = avgSpread * 0.4; // allow significant shrink during deep squat
                    this.calibratedShoulderAboveHipMargin = avgShoulderHipDiff * 0.3;

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

        // Use calibrated thresholds
        const isUpright =
            bodyVerticalSpread > this.calibratedMinBodyVerticalSpread &&
            shoulderHipDiff > this.calibratedShoulderAboveHipMargin;

        const isValidSquatPosition = isUpright;

        // ── 3. Alignment score ───────────────────────────────────────
        // For squats: how well the knees track over the ankles (not caving in).
        // We measure the horizontal deviation of knee midpoint from ankle midpoint.
        const alignmentScore = this.computeSquatAlignmentScore(
            leftKnee, rightKnee,
            leftAnkle, rightAnkle,
            leftHip, rightHip,
        );

        this.state.isValidPosition = isValidSquatPosition;

        // ── 4. State machine ─────────────────────────────────────────
        const prevPhase = this.state.currentPhase;

        if (smoothedAngle >= ANGLE_UP_THRESHOLD) {
            // UP phase — if we had a valid DOWN, count the rep
            if (this.hasReachedValidDown) {
                const repAmplitudeScore = this.computeAmplitudeScore(this.minAngleThisRep);
                const repAlignmentScore = this.bestAlignmentThisRep;
                const repScore = Math.round(repAmplitudeScore * 0.6 + repAlignmentScore * 0.4);
                this.recordRep(repScore, repAmplitudeScore, repAlignmentScore, this.minAngleThisRep);

                // Reset for next rep
                this.minAngleThisRep = 180;
                this.bestAlignmentThisRep = 100;
                this.hasReachedValidDown = false;
            }
            this.state.currentPhase = 'up';
        } else if (smoothedAngle <= ANGLE_DOWN_THRESHOLD) {
            if (isUpright) {
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
        if (minAngle >= ANGLE_DOWN_THRESHOLD) return 0;
        const score =
            ((ANGLE_DOWN_THRESHOLD - minAngle) / (ANGLE_DOWN_THRESHOLD - PERFECT_AMPLITUDE_ANGLE)) * 100;
        return Math.round(Math.max(0, Math.min(100, score)));
    }

    /**
     * Squat alignment: measures how well the torso stays vertically aligned.
     * Computes deviation of shoulder midpoint from hip midpoint horizontally.
     * A good squat keeps the torso relatively vertical.
     */
    private computeSquatAlignmentScore(
        leftKnee: Landmark, rightKnee: Landmark,
        leftAnkle: Landmark, rightAnkle: Landmark,
        leftHip: Landmark, rightHip: Landmark,
    ): number {
        const kneeMidX = (leftKnee.x + rightKnee.x) / 2;
        const ankleMidX = (leftAnkle.x + rightAnkle.x) / 2;
        const hipMidX = (leftHip.x + rightHip.x) / 2;

        // Knee tracking: knees should stay over ankles
        const kneeDeviation = Math.abs(kneeMidX - ankleMidX);
        const kneeScore = Math.max(0, 100 - (kneeDeviation / 0.08) * 100);

        // Hip alignment: hips should stay over ankles (not leaning forward)
        const hipDeviation = Math.abs(hipMidX - ankleMidX);
        const hipScore = Math.max(0, 100 - (hipDeviation / 0.12) * 100);

        return Math.min(100, Math.round(kneeScore * 0.6 + hipScore * 0.4));
    }
}
