import { BaseExerciseDetector } from '../BaseExerciseDetector';
import type { ExerciseState, Landmark, RepFeedback } from '../types';
import { getLegRaiseThresholds, type LegRaiseThresholds } from '@domain';

const LM = {
    LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
    LEFT_HIP: 23, RIGHT_HIP: 24,
    LEFT_KNEE: 25, RIGHT_KNEE: 26,
    LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
} as const;

// ── Positional constraints ──────────────────────────────────────
// MediaPipe is trained on upright poses — lying-down bodies produce noisier,
// lower-confidence landmarks. All thresholds are intentionally generous.
const MAX_BODY_VERTICAL_SPREAD = 0.55;
const MAX_TORSO_TILT = 0.30;
const MIN_LANDMARK_VISIBILITY = 0.25;

// ── Alignment thresholds ────────────────────────────────────────
const KNEE_STRAIGHT_TOLERANCE = 150;
const SHOULDER_RISE_TOLERANCE = 0.04;

// ── Key landmarks for post-calibration visibility check ─────────
// Only hips — shoulders/ankles/knees can all lose visibility for lying poses.
const KEY_LANDMARKS = [LM.LEFT_HIP, LM.RIGHT_HIP];
const POST_CAL_VISIBILITY = 0.35;

export class LegRaiseDetector extends BaseExerciseDetector {
    private worstKneeBend = 0;
    private worstShoulderRise = 0;
    private thresholds: LegRaiseThresholds;

    // ── Custom phase machine ──
    // Unlike push-ups/squats, leg raises count the rep at the PEAK (legs raised,
    // low hip angle) not at the REST position (legs flat, high hip angle).
    // So we invert the logic: latch at rest, count at peak.
    private hasReachedRest = false;
    private peakConfirmCount = 0;
    private wasRising = false;

    // ── Calibration data ──
    private calibrationFrames: { spread: number; torsoTilt: number; legLen: number; torsoLen: number; hipAngle: number; baselineShoulderY: number }[] = [];
    private calibratedMaxBodyVerticalSpread = MAX_BODY_VERTICAL_SPREAD;
    private calibratedMaxTorsoTilt = MAX_TORSO_TILT;
    private calibratedBaselineShoulderY = 0;

    constructor() {
        super();
        this.thresholds = getLegRaiseThresholds();
    }

    reset(): void {
        super.reset();
        this.worstKneeBend = 0;
        this.worstShoulderRise = 0;
        this.hasReachedRest = false;
        this.peakConfirmCount = 0;
        this.wasRising = false;
        this.calibrationFrames = [];
        this.calibratedMaxBodyVerticalSpread = MAX_BODY_VERTICAL_SPREAD;
        this.calibratedMaxTorsoTilt = MAX_TORSO_TILT;
        this.calibratedBaselineShoulderY = 0;
        this.thresholds = getLegRaiseThresholds();
    }

    processPose(landmarks: Landmark[]): ExerciseState {
        if (!landmarks || landmarks.length < 29) return this.getState();
        if (!this.areLandmarksPlausible(landmarks)) return this.getState();

        const lShoulder = landmarks[LM.LEFT_SHOULDER], rShoulder = landmarks[LM.RIGHT_SHOULDER];
        const lHip = landmarks[LM.LEFT_HIP], rHip = landmarks[LM.RIGHT_HIP];
        const lKnee = landmarks[LM.LEFT_KNEE], rKnee = landmarks[LM.RIGHT_KNEE];
        const lAnkle = landmarks[LM.LEFT_ANKLE], rAnkle = landmarks[LM.RIGHT_ANKLE];

        // ── 1. Smoothed hip angle (shoulder → hip → knee) ────────────
        // Always use knees instead of ankles for the primary angle.
        // Knees are consistently more visible in lying poses, and when legs
        // are straight, shoulder→hip→knee ≈ shoulder→hip→ankle.
        // Switching between ankle/knee mid-signal causes discontinuities
        // that break the One Euro Filter and prevent threshold detection.
        const leftAngle = this.computeAngle(lShoulder, lHip, lKnee);
        const rightAngle = this.computeAngle(rShoulder, rHip, rKnee);
        const leftVis = (lHip.visibility ?? 0) + (lKnee.visibility ?? 0);
        const rightVis = (rHip.visibility ?? 0) + (rKnee.visibility ?? 0);
        const smoothedAngle = this.smoothAngle(leftAngle, rightAngle, leftVis, rightVis);

        // ── 2. Positional metrics ───────────────────────────────────
        const midShoulderY = (lShoulder.y + rShoulder.y) / 2;
        const midHipY = (lHip.y + rHip.y) / 2;
        const midKneeY = (lKnee.y + rKnee.y) / 2;
        const bodyVerticalSpread = Math.abs(midShoulderY - midKneeY);
        const torsoTilt = Math.abs(midShoulderY - midHipY);

        const torsoLen = torsoTilt;
        const legLen = Math.abs(midHipY - midKneeY);

        // Knee straightness: only measurable when ankles are visible
        const lAnkleVis = lAnkle.visibility ?? 0;
        const rAnkleVis = rAnkle.visibility ?? 0;
        const anklesVisible = lAnkleVis >= 0.3 && rAnkleVis >= 0.3;
        const leftKneeAngle = anklesVisible ? this.computeAngle(lHip, lKnee, lAnkle) : 180;
        const rightKneeAngle = anklesVisible ? this.computeAngle(rHip, rKnee, rAnkle) : 180;
        const avgKneeAngle = (leftKneeAngle + rightKneeAngle) / 2;

        const shoulderRise = this.calibratedBaselineShoulderY > 0
            ? this.calibratedBaselineShoulderY - midShoulderY
            : 0;

        // ── 3. Calibration ──────────────────────────────────────────
        if (!this.state.isCalibrated) {
            const hipVis = Math.max(lHip.visibility ?? 0, rHip.visibility ?? 0);
            const kneeVis = Math.max(lKnee.visibility ?? 0, rKnee.visibility ?? 0);
            const areLowerVisible = hipVis > MIN_LANDMARK_VISIBILITY && kneeVis > MIN_LANDMARK_VISIBILITY;

            const isRoughlyLying =
                areLowerVisible &&
                bodyVerticalSpread < MAX_BODY_VERTICAL_SPREAD &&
                torsoTilt < MAX_TORSO_TILT &&
                smoothedAngle > 120;

            const status = this.updateCalibrationProgress(isRoughlyLying, !!this._bodyProfile?.legraise);

            if (status === 'collecting' || status === 'completed') {
                this.calibrationFrames.push({
                    spread: bodyVerticalSpread, torsoTilt, legLen, torsoLen,
                    hipAngle: smoothedAngle, baselineShoulderY: midShoulderY,
                });
            }
            if (status === 'completed') this.runFinalizeCalibration(landmarks);
            return this.getState();
        }

        // ── 4. Post-calibration guards ──────────────────────────────
        if (!this.isWithinLockedRegion(landmarks)) {
            this.state.isValidPosition = false;
            return this.getState();
        }
        if (!this.areLandmarksVisible(landmarks, KEY_LANDMARKS, POST_CAL_VISIBILITY)) {
            this.state.isValidPosition = false;
            return this.getState();
        }

        const isBodyHorizontal = bodyVerticalSpread < this.calibratedMaxBodyVerticalSpread;
        const isTorsoFlat = torsoTilt < this.calibratedMaxTorsoTilt;
        this.state.isValidPosition = isBodyHorizontal && isTorsoFlat;

        // ── 5. Alignment metrics ────────────────────────────────────
        const kneeStraightness = avgKneeAngle;
        const alignmentScore = this.computeAlignmentScore(kneeStraightness, shoulderRise, !anklesVisible);

        // ── 6. State machine (INVERTED — count at peak, not at rest) ─
        //
        // Leg raise rep cycle:
        //   REST (legs flat, high angle) → legs rise → PEAK (legs raised, low angle) → count rep
        //
        // This is opposite to push-ups/squats where reps count at rest.
        // The user expects the rep to register when the legs are UP.
        //
        const { angleUpThreshold: ANGLE_REST, angleDownThreshold: ANGLE_PEAK } = this.thresholds;
        const prevPhase = this.state.currentPhase;
        this.state.incompleteRepFeedback = null;

        if (smoothedAngle <= ANGLE_PEAK) {
            // ── PEAK: legs raised (low hip angle) ───────────────────
            this.peakConfirmCount++;
            this.wasRising = false;

            if (this.peakConfirmCount >= 2 && this.hasReachedRest) {
                const now = Date.now();
                const repDuration = this.lastRepTimestamp > 0 ? now - this.lastRepTimestamp : 2000;
                if (repDuration >= 600) {
                    const amplitudeScore = this.computeAmplitudeScore(this.minAngleThisRep);
                    const repAlignment = this.bestAlignmentThisRep;
                    const feedback = this.determineFeedback(amplitudeScore, repAlignment, this.worstKneeBend, this.worstShoulderRise, repDuration);
                    const repScore = this.computeRepScore(amplitudeScore, repAlignment);
                    this.lastRepTimestamp = now;
                    this.recordRep(repScore, amplitudeScore, repAlignment, this.minAngleThisRep, feedback);
                    this.captureDynamicCalibration(this.minAngleThisRep, 'min');
                }
                this.hasReachedRest = false;
                this.minAngleThisRep = 180;
                this.bestAlignmentThisRep = -Infinity;
                this.worstKneeBend = 0;
                this.worstShoulderRise = 0;
            }
            this.state.currentPhase = 'down';

        } else if (smoothedAngle >= ANGLE_REST) {
            // ── REST: legs flat (high hip angle) ────────────────────
            this.peakConfirmCount = 0;

            // Incomplete raise detection: was rising but didn't reach peak
            if (this.wasRising && this.hasReachedRest && this.minAngleThisRep < 170) {
                this.state.incompleteRepFeedback = 'raise_higher';
            }
            this.wasRising = false;
            this.hasReachedRest = true;
            this.state.currentPhase = 'up';

        } else {
            // ── TRANSITION ──────────────────────────────────────────
            if (prevPhase === 'up' || prevPhase === 'idle') this.wasRising = true;
            this.peakConfirmCount = 0;
            this.state.currentPhase = 'transition';
        }

        // ── 7. Track stats ──────────────────────────────────────────
        if (prevPhase !== 'idle') {
            if (smoothedAngle < this.minAngleThisRep) this.minAngleThisRep = smoothedAngle;
            if (alignmentScore > this.bestAlignmentThisRep) this.bestAlignmentThisRep = alignmentScore;
            if (avgKneeAngle < KNEE_STRAIGHT_TOLERANCE && (180 - avgKneeAngle) > this.worstKneeBend) {
                this.worstKneeBend = 180 - avgKneeAngle;
            }
            if (shoulderRise > this.worstShoulderRise) this.worstShoulderRise = shoulderRise;
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

        this.calibratedMaxBodyVerticalSpread = med(f => f.spread) + 0.35;
        this.calibratedMaxTorsoTilt = med(f => f.torsoTilt) + 0.20;
        this.calibratedBaselineShoulderY = med(f => f.baselineShoulderY);

        const medTorso = med(f => f.torsoLen);
        if (medTorso > 0.005) {
            this._capturedRatios.legraise = {
                legToTorsoRatio: med(f => f.legLen) / medTorso,
                naturalHipExtension: Math.round(med(f => f.hipAngle)),
            };
        }
    }

    // ── Scoring ─────────────────────────────────────────────────

    private computeAmplitudeScore(minAngle: number): number {
        return this.linearScore(minAngle, this.thresholds.angleDownThreshold, this.thresholds.perfectAmplitudeAngle);
    }

    private computeAlignmentScore(kneeStraightness: number, shoulderRise: number, anklesNotVisible: boolean): number {
        const shoulderScore = shoulderRise <= SHOULDER_RISE_TOLERANCE
            ? 100 : Math.max(0, 100 - ((shoulderRise - SHOULDER_RISE_TOLERANCE) / 0.06) * 100);

        // When ankles aren't visible, we can't judge knee straightness — score on shoulders only
        if (anklesNotVisible) return Math.min(100, Math.round(shoulderScore));

        const kneeScore = kneeStraightness >= 170
            ? 100 : kneeStraightness >= KNEE_STRAIGHT_TOLERANCE
                ? Math.round(((kneeStraightness - KNEE_STRAIGHT_TOLERANCE) / 20) * 100)
                : 0;

        return Math.min(100, Math.round(kneeScore * 0.5 + shoulderScore * 0.5));
    }

    private determineFeedback(
        amplitudeScore: number, alignmentScore: number,
        worstKneeBend: number, worstShoulderRise: number, repDurationMs: number,
    ): RepFeedback {
        if (amplitudeScore >= 90 && alignmentScore >= 85) return 'perfect';
        if (amplitudeScore < 60) return 'raise_higher';
        if (worstKneeBend > 40) return 'keep_legs_straight';
        if (worstShoulderRise > SHOULDER_RISE_TOLERANCE * 2.5) return 'keep_back_flat';
        if (repDurationMs < 800 && repDurationMs > 0) return 'too_fast';
        return 'good';
    }
}
