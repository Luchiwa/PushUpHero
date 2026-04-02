import { BaseExerciseDetector } from '../BaseExerciseDetector';
import type { ExerciseState, Landmark, RepFeedback } from '../types';
import { getPushupThresholds } from '@lib/bodyProfile';
import type { PushupThresholds } from '@lib/bodyProfile';

const LM = {
    LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
    LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
    LEFT_WRIST: 15, RIGHT_WRIST: 16,
    LEFT_HIP: 23, RIGHT_HIP: 24,
    LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
} as const;

// ── Positional constraints ──────────────────────────────────────
const MAX_BODY_VERTICAL_SPREAD = 0.65;
const WRIST_BELOW_SHOULDER_MARGIN = -0.15;

// ── Alignment thresholds ────────────────────────────────────────
const ARM_SYMMETRY_TOLERANCE = 15;
const HIP_DEVIATION_TOLERANCE = 0.04;

// ── Key landmarks for post-calibration visibility check ─────────
const KEY_LANDMARKS = [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_ELBOW, LM.RIGHT_ELBOW, LM.LEFT_HIP, LM.RIGHT_HIP];

export class PushUpDetector extends BaseExerciseDetector {
    private worstHipDeviation = 0;
    private worstArmAsymmetry = 0;
    private thresholds: PushupThresholds;

    // ── Calibration data ──
    private calibrationFrames: { spread: number; wristOffset: number; armLen: number; bodySpread: number; torsoLen: number; elbowAngle: number }[] = [];
    private calibratedMaxBodyVerticalSpread = MAX_BODY_VERTICAL_SPREAD;
    private calibratedWristBelowShoulderMargin = WRIST_BELOW_SHOULDER_MARGIN;

    constructor() {
        super();
        this.thresholds = getPushupThresholds(this._bodyProfile?.pushup ?? undefined);
    }

    reset(): void {
        super.reset();
        this.worstHipDeviation = 0;
        this.worstArmAsymmetry = 0;
        this.calibrationFrames = [];
        this.calibratedMaxBodyVerticalSpread = MAX_BODY_VERTICAL_SPREAD;
        this.calibratedWristBelowShoulderMargin = WRIST_BELOW_SHOULDER_MARGIN;
        this.thresholds = getPushupThresholds(this._bodyProfile?.pushup ?? undefined);
    }

    processPose(landmarks: Landmark[]): ExerciseState {
        if (!landmarks || landmarks.length < 29) return this.getState();

        const lShoulder = landmarks[LM.LEFT_SHOULDER], rShoulder = landmarks[LM.RIGHT_SHOULDER];
        const lElbow = landmarks[LM.LEFT_ELBOW], rElbow = landmarks[LM.RIGHT_ELBOW];
        const lWrist = landmarks[LM.LEFT_WRIST], rWrist = landmarks[LM.RIGHT_WRIST];
        const lHip = landmarks[LM.LEFT_HIP], rHip = landmarks[LM.RIGHT_HIP];
        const lAnkle = landmarks[LM.LEFT_ANKLE], rAnkle = landmarks[LM.RIGHT_ANKLE];

        // ── 1. Smoothed elbow angle ─────────────────────────────────
        const leftAngle = this.computeAngle(lShoulder, lElbow, lWrist);
        const rightAngle = this.computeAngle(rShoulder, rElbow, rWrist);
        const leftVis = (lElbow.visibility ?? 0) + (lWrist.visibility ?? 0);
        const rightVis = (rElbow.visibility ?? 0) + (rWrist.visibility ?? 0);
        const smoothedAngle = this.smoothAngle(leftAngle, rightAngle, leftVis, rightVis);

        // ── 2. Positional metrics ───────────────────────────────────
        const midShoulderY = (lShoulder.y + rShoulder.y) / 2;
        const midAnkleY = (lAnkle.y + rAnkle.y) / 2;
        const midWristY = (lWrist.y + rWrist.y) / 2;
        const bodyVerticalSpread = Math.abs(midShoulderY - midAnkleY);
        const wristOffset = midShoulderY - midWristY;

        // Body profile ratio data (every frame for calibration)
        const midHipY = (lHip.y + rHip.y) / 2;
        const torsoLen = Math.abs(midShoulderY - midHipY);
        const midShoulderX = (lShoulder.x + rShoulder.x) / 2;
        const midWristX = (lWrist.x + rWrist.x) / 2;
        const armLen = Math.sqrt((midWristX - midShoulderX) ** 2 + (midWristY - midShoulderY) ** 2);
        const midAnkleX = (lAnkle.x + rAnkle.x) / 2;
        const bodySpread = Math.sqrt((midAnkleX - midShoulderX) ** 2 + (midAnkleY - midShoulderY) ** 2);

        // ── 3. Calibration ──────────────────────────────────────────
        if (!this.state.isCalibrated) {
            const isRoughlyPlank = bodyVerticalSpread < MAX_BODY_VERTICAL_SPREAD && wristOffset < WRIST_BELOW_SHOULDER_MARGIN;
            const status = this.updateCalibrationProgress(isRoughlyPlank, !!this._bodyProfile?.pushup);

            if (status === 'collecting') {
                this.calibrationFrames.push({ spread: bodyVerticalSpread, wristOffset, armLen, bodySpread, torsoLen, elbowAngle: smoothedAngle });
            } else if (status === 'completed') {
                this.calibrationFrames.push({ spread: bodyVerticalSpread, wristOffset, armLen, bodySpread, torsoLen, elbowAngle: smoothedAngle });
                this.finalizeCalibration(landmarks);
            }
            return this.getState();
        }

        // ── 4. Post-calibration guards ──────────────────────────────
        if (!this.checkPostCalibrationGuards(landmarks, KEY_LANDMARKS)) return this.getState();

        const isBodyHorizontal = bodyVerticalSpread < this.calibratedMaxBodyVerticalSpread;
        const areWristsBelowShoulders = wristOffset < this.calibratedWristBelowShoulderMargin;
        const isValid = isBodyHorizontal && areWristsBelowShoulders;
        this.state.isValidPosition = isValid;

        // ── 5. Alignment metrics ────────────────────────────────────
        const armAsymmetry = Math.abs(leftAngle - rightAngle);
        const expectedHipY = (midShoulderY + midAnkleY) / 2;
        const hipDeviation = midHipY - expectedHipY;
        const alignmentScore = this.computeAlignmentScore(armAsymmetry, hipDeviation);

        // ── 6. State machine ────────────────────────────────────────
        const { angleUpThreshold: ANGLE_UP, angleDownThreshold: ANGLE_DOWN } = this.thresholds;
        const prevPhase = this.state.currentPhase;
        this.state.incompleteRepFeedback = null;

        if (smoothedAngle >= ANGLE_UP) {
            if (this.wasDescending && !this.hasReachedValidDown && this.minAngleThisRep < 170) {
                this.state.incompleteRepFeedback = 'go_lower';
            }
            this.wasDescending = false;

            if (this.hasReachedValidDown) {
                const repAmplitude = this.computeAmplitudeScore(this.minAngleThisRep);
                const repAlignment = this.bestAlignmentThisRep;
                const repScore = Math.round(repAmplitude * 0.6 + repAlignment * 0.4);
                const now = Date.now();
                const repDuration = this.lastRepTimestamp > 0 ? now - this.lastRepTimestamp : 2000;
                const feedback = this.determineFeedback(repAmplitude, repAlignment, this.worstHipDeviation, this.worstArmAsymmetry, repDuration);
                this.lastRepTimestamp = now;
                this.recordRep(repScore, repAmplitude, repAlignment, this.minAngleThisRep, feedback);
                this.captureDynamicCalibration(this.minAngleThisRep, 'min');
                this.resetRepTracking();
                this.worstHipDeviation = 0;
                this.worstArmAsymmetry = 0;
            }
            this.state.currentPhase = 'up';
        } else if (smoothedAngle <= ANGLE_DOWN) {
            this.hasReachedValidDown = isBodyHorizontal;
            this.wasDescending = true;
            this.state.currentPhase = 'down';
        } else {
            if (prevPhase === 'up' || prevPhase === 'idle') this.wasDescending = true;
            this.state.currentPhase = 'transition';
        }

        // ── 7. Track stats ──────────────────────────────────────────
        if (prevPhase !== 'idle') {
            if (smoothedAngle < this.minAngleThisRep) this.minAngleThisRep = smoothedAngle;
            if (alignmentScore > this.bestAlignmentThisRep) this.bestAlignmentThisRep = alignmentScore;
            if (Math.abs(hipDeviation) > Math.abs(this.worstHipDeviation)) this.worstHipDeviation = hipDeviation;
            if (armAsymmetry > this.worstArmAsymmetry) this.worstArmAsymmetry = armAsymmetry;
        }

        return this.getState();
    }

    // ── Calibration finalization ─────────────────────────────────

    private finalizeCalibration(landmarks: Landmark[]): void {
        const n = this.calibrationFrames.length;
        const avg = (fn: (f: typeof this.calibrationFrames[0]) => number) =>
            this.calibrationFrames.reduce((s, f) => s + fn(f), 0) / n;

        this.calibratedMaxBodyVerticalSpread = avg(f => f.spread) + 0.30;
        this.calibratedWristBelowShoulderMargin = avg(f => f.wristOffset) + 0.15;

        const avgTorso = avg(f => f.torsoLen);
        if (avgTorso > 0.01) {
            this._capturedRatios.pushup = {
                armToTorsoRatio: avg(f => f.armLen) / avgTorso,
                bodySpreadRatio: avg(f => f.bodySpread) / avgTorso,
                naturalElbowExtension: Math.round(avg(f => f.elbowAngle)),
            };
        }

        this.lockBoundingBox(landmarks);
    }

    // ── Scoring ─────────────────────────────────────────────────

    private computeAmplitudeScore(minAngle: number): number {
        const { angleDownThreshold, perfectAmplitudeAngle } = this.thresholds;
        if (minAngle <= perfectAmplitudeAngle) return 100;
        if (minAngle >= angleDownThreshold) return 0;
        return Math.round(Math.max(0, Math.min(100,
            ((angleDownThreshold - minAngle) / (angleDownThreshold - perfectAmplitudeAngle)) * 100)));
    }

    private computeAlignmentScore(armAsymmetry: number, hipDeviation: number): number {
        const symScore = armAsymmetry <= ARM_SYMMETRY_TOLERANCE
            ? 100 : Math.max(0, 100 - ((armAsymmetry - ARM_SYMMETRY_TOLERANCE) / 30) * 100);
        const absHipDev = Math.abs(hipDeviation);
        const hipScore = absHipDev <= HIP_DEVIATION_TOLERANCE
            ? 100 : Math.max(0, 100 - ((absHipDev - HIP_DEVIATION_TOLERANCE) / 0.08) * 100);
        return Math.min(100, Math.round(symScore * 0.5 + hipScore * 0.5));
    }

    private determineFeedback(
        amplitudeScore: number, alignmentScore: number,
        worstHipDev: number, worstArmAsym: number, repDurationMs: number,
    ): RepFeedback {
        if (amplitudeScore >= 90 && alignmentScore >= 85) return 'perfect';
        if (amplitudeScore < 60) return 'go_lower';
        if (worstHipDev > HIP_DEVIATION_TOLERANCE * 2) return 'body_sagging';
        if (worstHipDev < -HIP_DEVIATION_TOLERANCE * 2) return 'body_piking';
        if (worstArmAsym > ARM_SYMMETRY_TOLERANCE * 2) return 'arms_uneven';
        if (repDurationMs < 800 && repDurationMs > 0) return 'too_fast';
        return 'good';
    }
}
