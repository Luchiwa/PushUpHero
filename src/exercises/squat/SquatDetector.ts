import { BaseExerciseDetector } from '../BaseExerciseDetector';
import type { ExerciseState, Landmark, RepFeedback } from '../types';
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
const ANGLE_UP_THRESHOLD = 160;
const ANGLE_DOWN_THRESHOLD = 110;
const PERFECT_AMPLITUDE_ANGLE = 80;
const SMOOTHING_WINDOW = 5;

// ── Positional constraints ───────────────────────────────────────
const MIN_BODY_VERTICAL_SPREAD = 0.35;
const SHOULDER_ABOVE_HIP_MARGIN = 0.04;
const MIN_LANDMARK_VISIBILITY = 0.5;

// ── Alignment thresholds (front-facing camera) ───────────────────
/** Max knee X deviation from ankle X before penalising (normalised) */
const KNEE_TRACKING_TOLERANCE = 0.04;
/** Max torso lean: shoulder-hip horizontal deviation (normalised) */
const TORSO_LEAN_TOLERANCE = 0.03;

export class SquatDetector extends BaseExerciseDetector {
    private angleHistory: number[] = [];
    private minAngleThisRep: number = 180;
    private bestAlignmentThisRep: number = 0; // FIX: was 100
    private hasReachedValidDown = false;
    private lastRepTimestamp: number = 0;

    // Worst deviations tracking for feedback
    private worstKneeDeviation: number = 0;
    private worstTorsoLean: number = 0;

    // Track whether user was descending (to detect incomplete reps)
    private wasDescending: boolean = false;

    // ── Calibration State ──
    private calibrationFrames: { spread: number; shoulderHipDiff: number }[] = [];
    private calibratedMinBodyVerticalSpread = MIN_BODY_VERTICAL_SPREAD;
    private calibratedShoulderAboveHipMargin = SHOULDER_ABOVE_HIP_MARGIN;

    reset(): void {
        super.reset();
        this.angleHistory = [];
        this.minAngleThisRep = 180;
        this.bestAlignmentThisRep = 0;
        this.hasReachedValidDown = false;
        this.lastRepTimestamp = 0;
        this.worstKneeDeviation = 0;
        this.worstTorsoLean = 0;
        this.wasDescending = false;
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
        const shoulderHipDiff = midHipY - midShoulderY;

        if (!this.state.isCalibrated) {
            const kneeVis = Math.max(leftKnee.visibility ?? 0, rightKnee.visibility ?? 0);
            const ankleVis = Math.max(leftAnkle.visibility ?? 0, rightAnkle.visibility ?? 0);
            const areLowerLandmarksVisible =
                kneeVis > MIN_LANDMARK_VISIBILITY && ankleVis > MIN_LANDMARK_VISIBILITY;

            const midKneeY = (leftKnee.y + rightKnee.y) / 2;
            const isVerticallyOrdered =
                midShoulderY < midHipY && midHipY < midKneeY && midKneeY < midAnkleY;

            const isRoughlyStanding =
                areLowerLandmarksVisible &&
                isVerticallyOrdered &&
                bodyVerticalSpread > MIN_BODY_VERTICAL_SPREAD &&
                shoulderHipDiff > SHOULDER_ABOVE_HIP_MARGIN &&
                smoothedAngle > ANGLE_UP_THRESHOLD;

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

                    this.calibratedMinBodyVerticalSpread = avgSpread * 0.4;
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

        // Ensure key landmarks are actually visible (not hallucinated off-screen)
        const keyLandmarksVisible = this.areLandmarksVisible(
            landmarks,
            [LM.LEFT_HIP, LM.RIGHT_HIP, LM.LEFT_KNEE, LM.RIGHT_KNEE, LM.LEFT_ANKLE, LM.RIGHT_ANKLE],
            0.4,
        );

        const isUpright =
            keyLandmarksVisible &&
            bodyVerticalSpread > this.calibratedMinBodyVerticalSpread &&
            shoulderHipDiff > this.calibratedShoulderAboveHipMargin;

        const isValidSquatPosition = isUpright;

        // ── 3. Alignment metrics ─────────────────────────────────────
        const kneeMidX = (leftKnee.x + rightKnee.x) / 2;
        const ankleMidX = (leftAnkle.x + rightAnkle.x) / 2;
        const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
        const hipMidX = (leftHip.x + rightHip.x) / 2;

        const kneeDeviation = Math.abs(kneeMidX - ankleMidX);
        const torsoLean = Math.abs(shoulderMidX - hipMidX);

        const alignmentScore = this.computeSquatAlignmentScore(kneeDeviation, torsoLean);

        this.state.isValidPosition = isValidSquatPosition;

        // ── 4. State machine ─────────────────────────────────────────
        const prevPhase = this.state.currentPhase;
        this.state.incompleteRepFeedback = null; // clear each frame

        if (smoothedAngle >= ANGLE_UP_THRESHOLD) {
            // Detect incomplete rep: user was descending but came back up
            if (this.wasDescending && !this.hasReachedValidDown && this.minAngleThisRep < 170) {
                this.state.incompleteRepFeedback = 'go_lower';
            }
            this.wasDescending = false;

            if (this.hasReachedValidDown) {
                const repAmplitudeScore = this.computeAmplitudeScore(this.minAngleThisRep);
                const repAlignmentScore = this.bestAlignmentThisRep;
                const repScore = Math.round(repAmplitudeScore * 0.6 + repAlignmentScore * 0.4);

                const now = Date.now();
                const repDuration = this.lastRepTimestamp > 0 ? now - this.lastRepTimestamp : 2000;
                const feedback = this.determineFeedback(
                    repAmplitudeScore, repAlignmentScore,
                    this.worstKneeDeviation, this.worstTorsoLean,
                    repDuration,
                );
                this.lastRepTimestamp = now;

                this.recordRep(repScore, repAmplitudeScore, repAlignmentScore, this.minAngleThisRep, feedback);

                // Reset for next rep
                this.minAngleThisRep = 180;
                this.bestAlignmentThisRep = 0;
                this.hasReachedValidDown = false;
                this.worstKneeDeviation = 0;
                this.worstTorsoLean = 0;
            }
            this.state.currentPhase = 'up';
        } else if (smoothedAngle <= ANGLE_DOWN_THRESHOLD) {
            if (isUpright) {
                this.hasReachedValidDown = true;
            } else {
                this.hasReachedValidDown = false;
            }
            this.wasDescending = true;
            this.state.currentPhase = 'down';
        } else {
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
            if (kneeDeviation > this.worstKneeDeviation) {
                this.worstKneeDeviation = kneeDeviation;
            }
            if (torsoLean > this.worstTorsoLean) {
                this.worstTorsoLean = torsoLean;
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
     * Squat alignment for front-facing camera:
     * 1. Knee tracking: knees should stay over ankles (not caving in/out)
     * 2. Torso lean: shoulders should stay roughly above hips (not leaning forward)
     */
    private computeSquatAlignmentScore(kneeDeviation: number, torsoLean: number): number {
        // Knee tracking: 0-0.04 → 100, 0.04-0.12 → linear decay
        const kneeScore = kneeDeviation <= KNEE_TRACKING_TOLERANCE
            ? 100
            : Math.max(0, 100 - ((kneeDeviation - KNEE_TRACKING_TOLERANCE) / 0.08) * 100);

        // Torso lean: 0-0.03 → 100, 0.03-0.10 → linear decay
        const torsoScore = torsoLean <= TORSO_LEAN_TOLERANCE
            ? 100
            : Math.max(0, 100 - ((torsoLean - TORSO_LEAN_TOLERANCE) / 0.07) * 100);

        return Math.min(100, Math.round(kneeScore * 0.5 + torsoScore * 0.5));
    }

    /**
     * Determine the most important feedback for this rep.
     * Priority: amplitude > knees caving > torso lean > speed > good/perfect
     */
    private determineFeedback(
        amplitudeScore: number,
        alignmentScore: number,
        worstKneeDev: number,
        worstTorsoLean: number,
        repDurationMs: number,
    ): RepFeedback {
        if (amplitudeScore >= 90 && alignmentScore >= 85) return 'perfect';
        if (amplitudeScore < 60) return 'go_lower';
        if (worstKneeDev > KNEE_TRACKING_TOLERANCE * 2.5) return 'knees_caving';
        if (worstTorsoLean > TORSO_LEAN_TOLERANCE * 2.5) return 'lean_forward';
        if (repDurationMs < 800 && repDurationMs > 0) return 'too_fast';
        return 'good';
    }
}
