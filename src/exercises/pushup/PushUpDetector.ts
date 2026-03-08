import { BaseExerciseDetector } from '../BaseExerciseDetector';
import type { ExerciseState, Landmark } from '../types';

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
/** Elbow angle above which the position is considered "UP" (arms straight).
 * Raised to 155 so it works on both mobile (~175° up) and desktop webcam (~165° up) */
const ANGLE_UP_THRESHOLD = 155;
/** Elbow angle below which the position is considered "DOWN" (arms bent).
 * Raised to 145 so it captures desktop push-ups (~136-145°) as well as deep mobile reps (~61-93°) */
const ANGLE_DOWN_THRESHOLD = 145;
/** Perfect amplitude target — angle ≤ this gives full amplitude score */
const PERFECT_AMPLITUDE_ANGLE = 90;
/** Number of frames to smooth the angle signal */
const SMOOTHING_WINDOW = 5;

// ── Anti-cheat positional constraints ────────────────────────────
/**
 * Maximum allowed vertical spread between shoulder and ankle (normalized 0–1).
 * In a push-up (horizontal body): spread is small (~0.10–0.35).
 * Standing/seated: spread is large (~0.50–0.80).
 * 0.65 is very permissive for phones placed on the floor looking up at a steep angle.
 */
const MAX_BODY_VERTICAL_SPREAD = 0.65;

/**
 * Wrists must be BELOW (higher Y value) the shoulders for a valid push-up.
 * In push-up: hands are on the floor → wrist.y > shoulder.y.
 * Arms raised while seated: wrist.y < shoulder.y.
 * A larger negative margin (-0.15) allows for extreme camera angles (e.g. phone flat on ground).
 */
const WRIST_BELOW_SHOULDER_MARGIN = -0.15;

export class PushUpDetector extends BaseExerciseDetector {
    private angleHistory: number[] = [];
    private minAngleThisRep: number = 180;
    private bestAlignmentThisRep: number = 100;
    private hasReachedValidDown = false;
    private frameCount = 0; // for throttled debug logging

    // ── Calibration State ──
    private calibrationFrames: { spread: number, wristOffset: number }[] = [];
    private readonly CALIBRATION_FRAMES_REQUIRED = 90; // ~3 seconds at 30fps

    // Calibrated personalized thresholds
    private calibratedMaxBodyVerticalSpread = MAX_BODY_VERTICAL_SPREAD;
    private calibratedWristBelowShoulderMargin = WRIST_BELOW_SHOULDER_MARGIN;

    // Override reset to clear calibration as well
    reset(): void {
        super.reset();
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

        // ── 2. Positional validity checks (anti-cheat) & Calibration ─
        const midShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
        const midAnkleY = (leftAnkle.y + rightAnkle.y) / 2;
        const midWristY = (leftWrist.y + rightWrist.y) / 2;

        const bodyVerticalSpread = Math.abs(midShoulderY - midAnkleY);
        const wristOffset = midShoulderY - midWristY; // Negative means wrists are below shoulder

        // ── 2.5 Calibration logic ──
        if (!this.state.isCalibrated) {
            // Check if they are in a "rough" plank position using default wide thresholds
            const isRoughlyPlank = bodyVerticalSpread < MAX_BODY_VERTICAL_SPREAD && wristOffset < WRIST_BELOW_SHOULDER_MARGIN;

            if (isRoughlyPlank) {
                this.calibrationFrames.push({ spread: bodyVerticalSpread, wristOffset: wristOffset });
                this.state.calibratingPercentage = Math.min(100, Math.round((this.calibrationFrames.length / this.CALIBRATION_FRAMES_REQUIRED) * 100));

                if (this.calibrationFrames.length >= this.CALIBRATION_FRAMES_REQUIRED) {
                    // Compute averages
                    const avgSpread = this.calibrationFrames.reduce((s, f) => s + f.spread, 0) / this.calibrationFrames.length;
                    const avgWrist = this.calibrationFrames.reduce((s, f) => s + f.wristOffset, 0) / this.calibrationFrames.length;

                    // Set personalized thresholds with extra slack for various camera angles
                    this.calibratedMaxBodyVerticalSpread = avgSpread + 0.30; // More permissive for desktop/front cams
                    this.calibratedWristBelowShoulderMargin = avgWrist + 0.15; // Same

                    this.state.isCalibrated = true;
                    this.state.isValidPosition = true;
                }
            } else {
                // If they break the rough plank entirely, reset calibration progress
                // We add a tiny buffer so it doesn't flicker immediately, but resetting is safer
                this.calibrationFrames = [];
                this.state.calibratingPercentage = 0;
                this.state.isValidPosition = false;
            }

            // Do not evaluate reps during calibration
            return this.getState();
        }

        // Use calibrated personalized thresholds for reps
        const isBodyHorizontal = bodyVerticalSpread < this.calibratedMaxBodyVerticalSpread;
        const areWristsBelowShoulders = wristOffset < this.calibratedWristBelowShoulderMargin;

        const isValidPushUpPosition = isBodyHorizontal && areWristsBelowShoulders;

        // ── Debug logging (every 30 frames) ──
        this.frameCount++;
        if (this.frameCount % 30 === 0) {
            console.log('%c[PushUp Debug]', 'color: cyan; font-weight: bold', {
                angle: smoothedAngle.toFixed(1),
                ANGLE_UP: ANGLE_UP_THRESHOLD,
                ANGLE_DOWN: ANGLE_DOWN_THRESHOLD,
                phase: this.state.currentPhase,
                hasValidDown: this.hasReachedValidDown,
                spread: bodyVerticalSpread.toFixed(3),
                spreadMax: this.calibratedMaxBodyVerticalSpread.toFixed(3),
                isHorizontal: isBodyHorizontal,
                wristOffset: wristOffset.toFixed(3),
                wristMax: this.calibratedWristBelowShoulderMargin.toFixed(3),
                wristsOk: areWristsBelowShoulders,
                isValidPos: isValidPushUpPosition,
            });
        }

        // ── 3. Alignment score ───────────────────────────────────────
        const alignmentScore = this.computeAlignmentScore(
            leftShoulder, rightShoulder,
            leftHip, rightHip,
            leftAnkle, rightAnkle
        );

        // Always expose position validity for real-time UI feedback
        this.state.isValidPosition = isValidPushUpPosition;

        // ── 4. State machine ─────────────────────────────────────────
        const prevPhase = this.state.currentPhase;

        if (smoothedAngle >= ANGLE_UP_THRESHOLD) {
            // UP phase reached — if we had a valid DOWN, count the rep
            if (this.hasReachedValidDown) {
                const repAmplitudeScore = this.computeAmplitudeScore(this.minAngleThisRep);
                const repAlignmentScore = this.bestAlignmentThisRep;
                const repScore = Math.round(repAmplitudeScore * 0.6 + repAlignmentScore * 0.4);
                this.recordRep(repScore, repAmplitudeScore, repAlignmentScore, this.minAngleThisRep);
                console.log('%c[PushUp] REP COUNTED!', 'color: lime; font-weight: bold', { repScore, minAngle: this.minAngleThisRep.toFixed(1) });

                // Reset for next rep
                this.minAngleThisRep = 180;
                this.bestAlignmentThisRep = 100;
                this.hasReachedValidDown = false;
            }
            this.state.currentPhase = 'up';

        } else if (smoothedAngle <= ANGLE_DOWN_THRESHOLD) {
            // DOWN phase — require body to be horizontal to avoid counting when standing up
            if (isBodyHorizontal) {
                this.hasReachedValidDown = true;
            } else {
                // User is standing/vertical — clear any pending DOWN to prevent false reps
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
     * Body alignment: measures deviation of hip midpoint from shoulder-ankle line.
     */
    private computeAlignmentScore(
        leftShoulder: Landmark, rightShoulder: Landmark,
        leftHip: Landmark, rightHip: Landmark,
        leftAnkle: Landmark, rightAnkle: Landmark
    ): number {
        const shoulder = { x: (leftShoulder.x + rightShoulder.x) / 2, y: (leftShoulder.y + rightShoulder.y) / 2 };
        const hip = { x: (leftHip.x + rightHip.x) / 2, y: (leftHip.y + rightHip.y) / 2 };
        const ankle = { x: (leftAnkle.x + rightAnkle.x) / 2, y: (leftAnkle.y + rightAnkle.y) / 2 };

        const t = (ankle.y - shoulder.y) !== 0
            ? (hip.y - shoulder.y) / (ankle.y - shoulder.y)
            : 0;
        const expectedHipX = shoulder.x + t * (ankle.x - shoulder.x);
        const deviation = Math.abs(hip.x - expectedHipX);
        return Math.min(100, Math.round(Math.max(0, 100 - (deviation / 0.1) * 100)));
    }
}
