import { BaseExerciseDetector } from '../BaseExerciseDetector';
import type { ExerciseState, Landmark, RepFeedback } from '../types';
import { getSquatThresholds } from '@lib/bodyProfile';
import type { SquatThresholds } from '@lib/bodyProfile';

const LM = {
    LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
    LEFT_HIP: 23, RIGHT_HIP: 24,
    LEFT_KNEE: 25, RIGHT_KNEE: 26,
    LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
} as const;

// ── Positional constraints ──────────────────────────────────────
const MIN_BODY_VERTICAL_SPREAD = 0.35;
const SHOULDER_ABOVE_HIP_MARGIN = 0.04;
const DEFAULT_ANGLE_UP_THRESHOLD = 160;
const MIN_LANDMARK_VISIBILITY = 0.5;

// ── Alignment thresholds ────────────────────────────────────────
const KNEE_TRACKING_TOLERANCE = 0.04;
const TORSO_LEAN_TOLERANCE = 0.03;

// ── Key landmarks for post-calibration visibility check ─────────
const KEY_LANDMARKS = [LM.LEFT_HIP, LM.RIGHT_HIP, LM.LEFT_KNEE, LM.RIGHT_KNEE, LM.LEFT_ANKLE, LM.RIGHT_ANKLE];

export class SquatDetector extends BaseExerciseDetector {
    private worstKneeDeviation = 0;
    private worstTorsoLean = 0;
    private thresholds: SquatThresholds;

    // ── Calibration data ──
    private calibrationFrames: { spread: number; shoulderHipDiff: number; legLen: number; torsoLen: number; stanceWidth: number; kneeAngle: number }[] = [];
    private calibratedMinBodyVerticalSpread = MIN_BODY_VERTICAL_SPREAD;
    private calibratedShoulderAboveHipMargin = SHOULDER_ABOVE_HIP_MARGIN;

    constructor() {
        super();
        this.thresholds = getSquatThresholds(this._bodyProfile?.squat ?? undefined);
    }

    reset(): void {
        super.reset();
        this.worstKneeDeviation = 0;
        this.worstTorsoLean = 0;
        this.calibrationFrames = [];
        this.calibratedMinBodyVerticalSpread = MIN_BODY_VERTICAL_SPREAD;
        this.calibratedShoulderAboveHipMargin = SHOULDER_ABOVE_HIP_MARGIN;
        this.thresholds = getSquatThresholds(this._bodyProfile?.squat ?? undefined);
    }

    processPose(landmarks: Landmark[]): ExerciseState {
        if (!landmarks || landmarks.length < 29) return this.getState();

        const lShoulder = landmarks[LM.LEFT_SHOULDER], rShoulder = landmarks[LM.RIGHT_SHOULDER];
        const lHip = landmarks[LM.LEFT_HIP], rHip = landmarks[LM.RIGHT_HIP];
        const lKnee = landmarks[LM.LEFT_KNEE], rKnee = landmarks[LM.RIGHT_KNEE];
        const lAnkle = landmarks[LM.LEFT_ANKLE], rAnkle = landmarks[LM.RIGHT_ANKLE];

        // ── 1. Smoothed knee angle ──────────────────────────────────
        const leftAngle = this.computeAngle(lHip, lKnee, lAnkle);
        const rightAngle = this.computeAngle(rHip, rKnee, rAnkle);
        const leftVis = (lKnee.visibility ?? 0) + (lAnkle.visibility ?? 0);
        const rightVis = (rKnee.visibility ?? 0) + (rAnkle.visibility ?? 0);
        const smoothedAngle = this.smoothAngle(leftAngle, rightAngle, leftVis, rightVis);

        // ── 2. Positional metrics ───────────────────────────────────
        const midShoulderY = (lShoulder.y + rShoulder.y) / 2;
        const midHipY = (lHip.y + rHip.y) / 2;
        const midAnkleY = (lAnkle.y + rAnkle.y) / 2;
        const bodyVerticalSpread = Math.abs(midShoulderY - midAnkleY);
        const shoulderHipDiff = midHipY - midShoulderY;

        // Body profile ratio data
        const torsoLen = Math.abs(midShoulderY - midHipY);
        const midKneeY = (lKnee.y + rKnee.y) / 2;
        const legLen = Math.abs(midHipY - midAnkleY);
        const stanceWidth = Math.abs(lAnkle.x - rAnkle.x);
        const shoulderWidth = Math.abs(lShoulder.x - rShoulder.x);

        // ── 3. Calibration ──────────────────────────────────────────
        if (!this.state.isCalibrated) {
            const kneeVis = Math.max(lKnee.visibility ?? 0, rKnee.visibility ?? 0);
            const ankleVis = Math.max(lAnkle.visibility ?? 0, rAnkle.visibility ?? 0);
            const areLowerVisible = kneeVis > MIN_LANDMARK_VISIBILITY && ankleVis > MIN_LANDMARK_VISIBILITY;
            const isVerticallyOrdered = midShoulderY < midHipY && midHipY < midKneeY && midKneeY < midAnkleY;

            const isRoughlyStanding =
                areLowerVisible && isVerticallyOrdered &&
                bodyVerticalSpread > MIN_BODY_VERTICAL_SPREAD &&
                shoulderHipDiff > SHOULDER_ABOVE_HIP_MARGIN &&
                smoothedAngle > DEFAULT_ANGLE_UP_THRESHOLD;

            const status = this.updateCalibrationProgress(isRoughlyStanding, !!this._bodyProfile?.squat);

            if (status === 'collecting' || status === 'completed') {
                this.calibrationFrames.push({
                    spread: bodyVerticalSpread, shoulderHipDiff, legLen, torsoLen,
                    stanceWidth: shoulderWidth > 0.01 ? stanceWidth / shoulderWidth : 1,
                    kneeAngle: smoothedAngle,
                });
            }
            if (status === 'completed') this.finalizeCalibration(landmarks);
            return this.getState();
        }

        // ── 4. Post-calibration guards ──────────────────────────────
        if (!this.checkPostCalibrationGuards(landmarks, KEY_LANDMARKS)) return this.getState();

        const isUpright =
            bodyVerticalSpread > this.calibratedMinBodyVerticalSpread &&
            shoulderHipDiff > this.calibratedShoulderAboveHipMargin;
        this.state.isValidPosition = isUpright;

        // ── 5. Alignment metrics ────────────────────────────────────
        const kneeMidX = (lKnee.x + rKnee.x) / 2;
        const ankleMidX = (lAnkle.x + rAnkle.x) / 2;
        const shoulderMidX = (lShoulder.x + rShoulder.x) / 2;
        const hipMidX = (lHip.x + rHip.x) / 2;
        const kneeDeviation = Math.abs(kneeMidX - ankleMidX);
        const torsoLean = Math.abs(shoulderMidX - hipMidX);
        const alignmentScore = this.computeAlignmentScore(kneeDeviation, torsoLean);

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
                const feedback = this.determineFeedback(repAmplitude, repAlignment, this.worstKneeDeviation, this.worstTorsoLean, repDuration);
                this.lastRepTimestamp = now;
                this.recordRep(repScore, repAmplitude, repAlignment, this.minAngleThisRep, feedback);
                this.captureDynamicCalibration(this.minAngleThisRep, 'min');
                this.resetRepTracking();
                this.worstKneeDeviation = 0;
                this.worstTorsoLean = 0;
            }
            this.state.currentPhase = 'up';
        } else if (smoothedAngle <= ANGLE_DOWN) {
            this.hasReachedValidDown = isUpright;
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
            if (kneeDeviation > this.worstKneeDeviation) this.worstKneeDeviation = kneeDeviation;
            if (torsoLean > this.worstTorsoLean) this.worstTorsoLean = torsoLean;
        }

        return this.getState();
    }

    // ── Calibration finalization ─────────────────────────────────

    private finalizeCalibration(landmarks: Landmark[]): void {
        const n = this.calibrationFrames.length;
        const avg = (fn: (f: typeof this.calibrationFrames[0]) => number) =>
            this.calibrationFrames.reduce((s, f) => s + fn(f), 0) / n;

        this.calibratedMinBodyVerticalSpread = avg(f => f.spread) * 0.4;
        this.calibratedShoulderAboveHipMargin = avg(f => f.shoulderHipDiff) * 0.3;

        const avgTorso = avg(f => f.torsoLen);
        if (avgTorso > 0.01) {
            this._capturedRatios.squat = {
                legToTorsoRatio: avg(f => f.legLen) / avgTorso,
                naturalKneeExtension: Math.round(avg(f => f.kneeAngle)),
                stanceWidthRatio: avg(f => f.stanceWidth),
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

    private computeAlignmentScore(kneeDeviation: number, torsoLean: number): number {
        const kneeScore = kneeDeviation <= KNEE_TRACKING_TOLERANCE
            ? 100 : Math.max(0, 100 - ((kneeDeviation - KNEE_TRACKING_TOLERANCE) / 0.08) * 100);
        const torsoScore = torsoLean <= TORSO_LEAN_TOLERANCE
            ? 100 : Math.max(0, 100 - ((torsoLean - TORSO_LEAN_TOLERANCE) / 0.07) * 100);
        return Math.min(100, Math.round(kneeScore * 0.5 + torsoScore * 0.5));
    }

    private determineFeedback(
        amplitudeScore: number, alignmentScore: number,
        worstKneeDev: number, worstTorsoLean: number, repDurationMs: number,
    ): RepFeedback {
        if (amplitudeScore >= 90 && alignmentScore >= 85) return 'perfect';
        if (amplitudeScore < 60) return 'go_lower';
        if (worstKneeDev > KNEE_TRACKING_TOLERANCE * 2.5) return 'knees_caving';
        if (worstTorsoLean > TORSO_LEAN_TOLERANCE * 2.5) return 'lean_forward';
        if (repDurationMs < 800 && repDurationMs > 0) return 'too_fast';
        return 'good';
    }
}
