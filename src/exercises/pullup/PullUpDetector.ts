import { BaseExerciseDetector } from '../BaseExerciseDetector';
import type { ExerciseState, Landmark, RepFeedback } from '../types';
import { getPullupThresholds, type PullupThresholds } from '@domain';

const LM = {
    LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
    LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
    LEFT_WRIST: 15, RIGHT_WRIST: 16,
    LEFT_HIP: 23, RIGHT_HIP: 24,
} as const;

// ── Rise thresholds ─────────────────────────────────────────────
const RISE_DOWN_FRACTION = 0.12;

// ── Elbow confirmation ──────────────────────────────────────────
const ELBOW_CONFIRM_UP = 100;
const ELBOW_CONFIRM_DOWN = 120;

// ── Positional constraints ──────────────────────────────────────
const MIN_SHOULDER_HIP_SPREAD = 0.08;
const WRIST_ABOVE_SHOULDER_MARGIN = 0.15;

// ── Alignment thresholds ────────────────────────────────────────
const ARM_SYMMETRY_TOLERANCE = 20;
const BODY_SWAY_TOLERANCE = 0.04;
const KIPPING_VELOCITY_THRESHOLD = 0.025;
const SMOOTHING_WINDOW = 3;

// ── Key landmarks for post-calibration visibility check ─────────
// Elbows removed: they go above/behind the bar during pull-ups, reducing visibility
const KEY_LANDMARKS = [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP];

export class PullUpDetector extends BaseExerciseDetector {
    // Pull-up specific: shoulder Y tracking
    private shoulderYHistory: number[] = [];
    private maxRiseThisRep = 0;

    // Kipping detection
    private prevHipY: number | null = null;
    private maxHipVelocity = 0;

    // Worst deviations
    private worstArmAsymmetry = 0;
    private worstBodySway = 0;

    private thresholds: PullupThresholds;

    // ── Calibration data ──
    private calibrationFrames: { spread: number; wristOffset: number; shoulderY: number; armLen: number; torsoLen: number; elbowAngle: number }[] = [];
    private calibratedMinShoulderHipSpread = MIN_SHOULDER_HIP_SPREAD;
    private calibratedWristAboveShoulderMargin = WRIST_ABOVE_SHOULDER_MARGIN;
    private calibratedBaselineShoulderY = 0;
    private calibratedTorsoLength = 0.2;

    constructor() {
        super();
        this.thresholds = getPullupThresholds();
    }

    reset(): void {
        super.reset();
        this.shoulderYHistory = [];
        this.maxRiseThisRep = 0;
        this.prevHipY = null;
        this.maxHipVelocity = 0;
        this.worstArmAsymmetry = 0;
        this.worstBodySway = 0;
        this.calibrationFrames = [];
        this.calibratedMinShoulderHipSpread = MIN_SHOULDER_HIP_SPREAD;
        this.calibratedWristAboveShoulderMargin = WRIST_ABOVE_SHOULDER_MARGIN;
        this.calibratedBaselineShoulderY = 0;
        this.calibratedTorsoLength = 0.2;
        this.thresholds = getPullupThresholds();
    }

    processPose(landmarks: Landmark[]): ExerciseState {
        if (!landmarks || landmarks.length < 25) return this.getState();
        if (!this.areLandmarksPlausible(landmarks)) return this.getState();

        const lShoulder = landmarks[LM.LEFT_SHOULDER], rShoulder = landmarks[LM.RIGHT_SHOULDER];
        const lElbow = landmarks[LM.LEFT_ELBOW], rElbow = landmarks[LM.RIGHT_ELBOW];
        const lWrist = landmarks[LM.LEFT_WRIST], rWrist = landmarks[LM.RIGHT_WRIST];
        const lHip = landmarks[LM.LEFT_HIP], rHip = landmarks[LM.RIGHT_HIP];

        // ── 1. Smoothed elbow angle ─────────────────────────────────
        const leftAngle = this.computeAngle(lShoulder, lElbow, lWrist);
        const rightAngle = this.computeAngle(rShoulder, rElbow, rWrist);
        const leftVis = (lElbow.visibility ?? 0) + (lWrist.visibility ?? 0);
        const rightVis = (rElbow.visibility ?? 0) + (rWrist.visibility ?? 0);
        const smoothedAngle = this.smoothAngle(leftAngle, rightAngle, leftVis, rightVis);

        // ── 2. Shoulder vertical position (smoothed) ────────────────
        const midShoulderY = (lShoulder.y + rShoulder.y) / 2;
        const midHipY = (lHip.y + rHip.y) / 2;
        const midWristY = (lWrist.y + rWrist.y) / 2;

        this.shoulderYHistory.push(midShoulderY);
        if (this.shoulderYHistory.length > SMOOTHING_WINDOW) this.shoulderYHistory.shift();
        const smoothedShoulderY = this.shoulderYHistory.reduce((s, v) => s + v, 0) / this.shoulderYHistory.length;

        const shoulderHipSpread = Math.abs(midShoulderY - midHipY);
        const wristOffset = midWristY - midShoulderY;

        // Rise from baseline (Y decreases upward)
        const shoulderRise = this.calibratedBaselineShoulderY - smoothedShoulderY;
        const riseFraction = this.calibratedTorsoLength > 0 ? shoulderRise / this.calibratedTorsoLength : 0;

        // Kipping: track hip Y velocity
        let hipVelocity = 0;
        if (this.prevHipY !== null) hipVelocity = Math.abs(midHipY - this.prevHipY);
        this.prevHipY = midHipY;

        // ── 3. Calibration (dead hang) ──────────────────────────────
        if (!this.state.isCalibrated) {
            const isRoughlyHanging =
                shoulderHipSpread > MIN_SHOULDER_HIP_SPREAD &&
                wristOffset < WRIST_ABOVE_SHOULDER_MARGIN &&
                smoothedAngle > ELBOW_CONFIRM_DOWN;

            const status = this.updateCalibrationProgress(isRoughlyHanging, !!this._bodyProfile?.pullup);

            if (status === 'collecting' || status === 'completed') {
                this.calibrationFrames.push({
                    spread: shoulderHipSpread, wristOffset, shoulderY: midShoulderY,
                    armLen: Math.sqrt(
                        ((lWrist.x + rWrist.x) / 2 - (lShoulder.x + rShoulder.x) / 2) ** 2 +
                        ((lWrist.y + rWrist.y) / 2 - midShoulderY) ** 2,
                    ),
                    torsoLen: shoulderHipSpread, elbowAngle: smoothedAngle,
                });
            }
            if (status === 'completed') this.runFinalizeCalibration(landmarks);
            return this.getState();
        }

        // ── 4. Post-calibration guards ──────────────────────────────
        if (!this.checkPostCalibrationGuards(landmarks, KEY_LANDMARKS)) return this.getState();

        const isBodyVisible = shoulderHipSpread > this.calibratedMinShoulderHipSpread;
        const areWristsAbove = wristOffset < this.calibratedWristAboveShoulderMargin;
        const isValid = isBodyVisible && areWristsAbove;
        this.state.isValidPosition = isValid;

        // ── 5. Alignment metrics ────────────────────────────────────
        const armAsymmetry = Math.abs(leftAngle - rightAngle);
        const shoulderMidX = (lShoulder.x + rShoulder.x) / 2;
        const hipMidX = (lHip.x + rHip.x) / 2;
        const bodySway = Math.abs(shoulderMidX - hipMidX);
        const alignmentScore = this.computeAlignmentScore(armAsymmetry, bodySway, hipVelocity);

        // ── 6. State machine (shoulder rise + elbow confirmation) ───
        const { riseUpFraction: RISE_UP } = this.thresholds;
        const prevPhase = this.state.currentPhase;
        this.state.incompleteRepFeedback = null;

        const isUp = riseFraction >= RISE_UP && smoothedAngle <= ELBOW_CONFIRM_UP;
        const isDown = riseFraction <= RISE_DOWN_FRACTION && smoothedAngle >= ELBOW_CONFIRM_DOWN;

        if (isUp) {
            this._downConfirmCount = 0;
            if (this.hasReachedValidDown) {
                const repAmplitude = this.computeAmplitudeScore(this.maxRiseThisRep);
                const repAlignment = this.bestAlignmentThisRep;
                const repScore = this.computeRepScore(repAmplitude, repAlignment);
                const now = Date.now();
                const repDuration = this.lastRepTimestamp > 0 ? now - this.lastRepTimestamp : 3000;
                const feedback = this.determineFeedback(repAmplitude, repAlignment, this.worstArmAsymmetry, this.worstBodySway, this.maxHipVelocity, repDuration);
                this.lastRepTimestamp = now;
                this.recordRep(repScore, repAmplitude, repAlignment, this.minAngleThisRep, feedback);
                this.captureDynamicCalibration(this.maxRiseThisRep, 'max');
                this.resetRepTracking();
                this.maxRiseThisRep = 0;
                this.maxHipVelocity = 0;
                this.worstArmAsymmetry = 0;
                this.worstBodySway = 0;
            }
            this.state.currentPhase = 'up';
        } else if (isDown) {
            // Hysteresis: require 2 consecutive frames in down zone before confirming
            this._downConfirmCount++;
            if (this.wasDescending && this.maxRiseThisRep > 0.1 && this.maxRiseThisRep < RISE_UP) {
                this.state.incompleteRepFeedback = 'go_lower';
            }
            this.wasDescending = false;
            if (this._downConfirmCount >= 2) {
                this.hasReachedValidDown = true;
            }
            this.state.currentPhase = 'down';
        } else {
            if (prevPhase === 'down') this.wasDescending = true;
            this.state.currentPhase = 'transition';
        }

        // ── 7. Track stats ──────────────────────────────────────────
        if (prevPhase !== 'idle') {
            if (riseFraction > this.maxRiseThisRep) this.maxRiseThisRep = riseFraction;
            if (smoothedAngle < this.minAngleThisRep) this.minAngleThisRep = smoothedAngle;
            if (alignmentScore > this.bestAlignmentThisRep) this.bestAlignmentThisRep = alignmentScore;
            if (hipVelocity > this.maxHipVelocity) this.maxHipVelocity = hipVelocity;
            if (armAsymmetry > this.worstArmAsymmetry) this.worstArmAsymmetry = armAsymmetry;
            if (bodySway > this.worstBodySway) this.worstBodySway = bodySway;
        }

        return this.getState();
    }

    // ── Calibration finalization ─────────────────────────────────

    protected getCalibrationFrames(): unknown[] {
        return this.calibrationFrames;
    }

    protected captureCalibrationRatios(medUntyped: (extractor: (f: unknown) => number) => number): void {
        type Frame = (typeof this.calibrationFrames)[number];
        const med = medUntyped as (extractor: (f: Frame) => number) => number;

        const medSpread = med(f => f.spread);
        this.calibratedMinShoulderHipSpread = medSpread * 0.3;
        this.calibratedWristAboveShoulderMargin = med(f => f.wristOffset) + 0.25;
        this.calibratedBaselineShoulderY = med(f => f.shoulderY);
        this.calibratedTorsoLength = medSpread;

        const medTorso = med(f => f.torsoLen);
        if (medTorso > 0.01) {
            this._capturedRatios.pullup = {
                armToTorsoRatio: med(f => f.armLen) / medTorso,
                naturalArmExtension: Math.round(med(f => f.elbowAngle)),
            };
        }
    }

    // ── Scoring ─────────────────────────────────────────────────

    private computeAmplitudeScore(maxRise: number): number {
        const { riseUpFraction, perfectRiseFraction } = this.thresholds;
        if (maxRise >= perfectRiseFraction) return 100;
        if (maxRise <= riseUpFraction) return 50;
        // Linear interpolation in 50–100 range (pull-ups always get at least 50 for reaching the bar)
        return Math.round(50 + this.linearScore(maxRise, riseUpFraction, perfectRiseFraction) * 0.5);
    }

    private computeAlignmentScore(armAsymmetry: number, bodySway: number, hipVelocity: number): number {
        const symScore = armAsymmetry <= ARM_SYMMETRY_TOLERANCE
            ? 100 : Math.max(0, 100 - ((armAsymmetry - ARM_SYMMETRY_TOLERANCE) / 30) * 100);
        const swayScore = bodySway <= BODY_SWAY_TOLERANCE
            ? 100 : Math.max(0, 100 - ((bodySway - BODY_SWAY_TOLERANCE) / 0.08) * 100);
        const kipScore = hipVelocity <= KIPPING_VELOCITY_THRESHOLD
            ? 100 : Math.max(0, 100 - ((hipVelocity - KIPPING_VELOCITY_THRESHOLD) / 0.035) * 100);
        return Math.min(100, Math.round(symScore * 0.35 + swayScore * 0.30 + kipScore * 0.35));
    }

    private determineFeedback(
        amplitudeScore: number, alignmentScore: number,
        worstArmAsym: number, worstBodySway: number,
        maxHipVel: number, repDurationMs: number,
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
