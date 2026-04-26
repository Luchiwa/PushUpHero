import { AngleBasedExerciseDetector } from '../base/AngleBasedExerciseDetector';
import type { ExerciseState, Landmark, RepFeedback } from '../types';
import { getPushupThresholds } from '@domain/bodyProfile';
import type { PushupThresholds } from '@domain/bodyProfile';

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

// ── Debounce ───────────────────────────────────────────────────
/** Minimum milliseconds between two counted reps (blocks jitter-induced false reps) */
const MIN_REP_INTERVAL_MS = 500;

// ── Key landmarks for post-calibration visibility check ─────────
// Elbows removed: visibility drops when arms are fully extended at the top of a push-up,
// which would reject frames at the exact moment the UP phase should trigger.
const KEY_LANDMARKS = [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP];

export class PushUpDetector extends AngleBasedExerciseDetector {
    private worstHipDeviation = 0;
    private worstArmAsymmetry = 0;
    private thresholds: PushupThresholds;

    // ── Calibration data ──
    private calibrationFrames: { spread: number; wristOffset: number; armLen: number; bodySpread: number; torsoLen: number; elbowAngle: number }[] = [];
    private calibratedMaxBodyVerticalSpread = MAX_BODY_VERTICAL_SPREAD;
    private calibratedWristBelowShoulderMargin = WRIST_BELOW_SHOULDER_MARGIN;
    /** Max shoulder–hip Y distance allowed (rejects upright/leaning poses) */
    private calibratedMaxTorsoTilt = 0.25;

    constructor() {
        super();
        this.thresholds = getPushupThresholds();
    }

    reset(): void {
        super.reset();
        this.worstHipDeviation = 0;
        this.worstArmAsymmetry = 0;
        this.calibrationFrames = [];
        this.calibratedMaxBodyVerticalSpread = MAX_BODY_VERTICAL_SPREAD;
        this.calibratedWristBelowShoulderMargin = WRIST_BELOW_SHOULDER_MARGIN;
        this.calibratedMaxTorsoTilt = 0.25;
        this.thresholds = getPushupThresholds();
    }

    processPose(landmarks: Landmark[]): ExerciseState {
        if (!landmarks || landmarks.length < 29) return this.getState();
        if (!this.areLandmarksPlausible(landmarks)) return this.getState();

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
                this.runFinalizeCalibration(landmarks);
            }
            return this.getState();
        }

        // ── 4. Post-calibration guards ──────────────────────────────
        if (!this.checkPostCalibrationGuards(landmarks, KEY_LANDMARKS)) return this.getState();

        const isTorsoFlat = torsoLen < this.calibratedMaxTorsoTilt;
        const isBodyHorizontal = bodyVerticalSpread < this.calibratedMaxBodyVerticalSpread;
        const areWristsBelowShoulders = wristOffset < this.calibratedWristBelowShoulderMargin;
        this.state.isValidPosition = isBodyHorizontal && isTorsoFlat && areWristsBelowShoulders;

        // ── 5. Alignment metrics ────────────────────────────────────
        const armAsymmetry = Math.abs(leftAngle - rightAngle);
        const expectedHipY = (midShoulderY + midAnkleY) / 2;
        const hipDeviation = midHipY - expectedHipY;
        const alignmentScore = this.computeAlignmentScore(armAsymmetry, hipDeviation);

        // ── 6. State machine (template method) ───────────────────────
        const { angleUpThreshold: ANGLE_UP, angleDownThreshold: ANGLE_DOWN } = this.thresholds;
        const prevPhase = this.state.currentPhase;

        this.processAngleBasedPhase(
            smoothedAngle, ANGLE_UP, ANGLE_DOWN,
            isBodyHorizontal, MIN_REP_INTERVAL_MS,
            (repDuration) => ({
                amplitudeScore: this.computeAmplitudeScore(this.minAngleThisRep),
                alignmentScore: this.bestAlignmentThisRep,
                feedback: this.determineFeedback(this.computeAmplitudeScore(this.minAngleThisRep), this.bestAlignmentThisRep, this.worstHipDeviation, this.worstArmAsymmetry, repDuration),
            }),
            () => { this.worstHipDeviation = 0; this.worstArmAsymmetry = 0; },
        );

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

    protected getCalibrationFrames(): unknown[] {
        return this.calibrationFrames;
    }

    protected captureCalibrationRatios(medUntyped: (extractor: (f: unknown) => number) => number): void {
        type Frame = (typeof this.calibrationFrames)[number];
        const med = medUntyped as (extractor: (f: Frame) => number) => number;

        this.calibratedMaxBodyVerticalSpread = med(f => f.spread) + 0.30;
        this.calibratedWristBelowShoulderMargin = med(f => f.wristOffset) + 0.15;

        const medTorso = med(f => f.torsoLen);
        // In plank position, shoulder–hip Y distance is small. Allow generous margin
        // but reject clearly upright/leaning poses (e.g. getting up after push-ups).
        this.calibratedMaxTorsoTilt = medTorso + 0.15;
        if (medTorso > 0.01) {
            this._capturedRatios.pushup = {
                armToTorsoRatio: med(f => f.armLen) / medTorso,
                bodySpreadRatio: med(f => f.bodySpread) / medTorso,
                naturalElbowExtension: Math.round(med(f => f.elbowAngle)),
            };
        }
    }

    // ── Scoring ─────────────────────────────────────────────────

    private computeAmplitudeScore(minAngle: number): number {
        return this.linearScore(minAngle, this.thresholds.angleDownThreshold, this.thresholds.perfectAmplitudeAngle);
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
