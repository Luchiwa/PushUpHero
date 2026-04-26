import type { ExerciseState, Landmark, RepFeedback } from './types';
import type { BodyProfile } from '@domain/bodyProfile';
import { CALIBRATION_FRAMES_REQUIRED } from '@domain/constants';
import { OneEuroFilter } from '@infra/oneEuroFilter';

// ── Captured Ratios ──────────────────────────────────────────────
// Detectors populate these during calibration + first reps.
// The hook reads them out and merges into the stored BodyProfile.
export interface CapturedRatios {
    pushup?: {
        armToTorsoRatio: number;
        bodySpreadRatio: number;
        naturalElbowExtension: number;
    };
    squat?: {
        legToTorsoRatio: number;
        naturalKneeExtension: number;
        stanceWidthRatio: number;
    };
    pullup?: {
        armToTorsoRatio: number;
        naturalArmExtension: number;
    };
    legraise?: {
        legToTorsoRatio: number;
        naturalHipExtension: number;
    };
    /** Dynamic calibration value captured during first N reps (min angle for pushup/squat, max rise for pullup) */
    dynamicCalibration?: number;
}

// ── Bounding Box Lock ────────────────────────────────────────────

/** Tolerance for center drift (fraction of frame). */
const BBOX_CENTER_TOLERANCE = 0.25;
/** Tolerance for size change (ratio — 0.45 = ±45%). */
const BBOX_SIZE_TOLERANCE = 0.45;
/** Number of consecutive rejected frames before the lock adapts slightly. */
const BBOX_ADAPT_AFTER_FRAMES = 90;
/** How much the lock drifts toward the current bbox per adaptation step. */
const BBOX_ADAPT_RATE = 0.05;

/** Number of reps to capture for dynamic calibration */
const DYNAMIC_CAPTURE_REPS = 5;

interface BoundingBox {
    centerX: number;
    centerY: number;
    width: number;
    height: number;
}

/**
 * Abstract base class for all exercise detectors.
 * Provides shared state management, angle smoothing, calibration orchestration,
 * bounding box lock, and rep tracking.
 */
export abstract class BaseExerciseDetector {
    protected state: ExerciseState;
    protected _bodyProfile: BodyProfile | null = null;
    protected _capturedRatios: CapturedRatios = {};

    // ── Angle smoothing (adaptive One Euro Filter) ───────────────
    // Replaces the fixed 3-frame sliding window. Adaptive: more smoothing at
    // rest, less lag during fast movements → preserves angle peaks better.
    private _angleSmoother = new OneEuroFilter(2.0, 0.7);

    // ── Calibration ─────────────────────────────────────────────
    protected calibrationFrameCount = 0;

    // ── Rep tracking (common across all detectors) ──────────────
    protected minAngleThisRep = 180;
    protected bestAlignmentThisRep = -Infinity;
    protected hasReachedValidDown = false;
    protected lastRepTimestamp = 0;
    protected wasDescending = false;
    protected _downConfirmCount = 0;
    private _dynamicValues: number[] = [];

    // ── Bounding Box Lock state ─────────────────────────────────
    private lockedBbox: BoundingBox | null = null;
    private bboxRejectStreak = 0;

    constructor() {
        this.state = this.initialState();
    }

    protected initialState(): ExerciseState {
        return {
            repCount: 0,
            averageScore: 0,
            currentPhase: 'idle',
            lastRepResult: null,
            repHistory: [],
            isValidPosition: false,
            isCalibrated: false,
            calibratingPercentage: 0,
            incompleteRepFeedback: null,
            poseRejectedByLock: false,
        };
    }

    /** Process a new pose frame. Returns updated exercise state. */
    abstract processPose(landmarks: Landmark[]): ExerciseState;

    /** Reset all state (called on "Try Again"). */
    reset(): void {
        this.state = this.initialState();
        this._angleSmoother = new OneEuroFilter(2.0, 0.7);
        this.calibrationFrameCount = 0;
        this.minAngleThisRep = 180;
        this.bestAlignmentThisRep = -Infinity;
        this.hasReachedValidDown = false;
        this.lastRepTimestamp = 0;
        this.wasDescending = false;
        this._downConfirmCount = 0;
        this._dynamicValues = [];
        this.lockedBbox = null;
        this.bboxRejectStreak = 0;
    }

    getState(): ExerciseState {
        return { ...this.state };
    }

    /** Inject an existing body profile (used for adaptive thresholds). */
    setBodyProfile(profile: BodyProfile | null): void {
        this._bodyProfile = profile;
    }

    /** Retrieve morphological ratios captured during calibration + reps. */
    getCapturedRatios(): CapturedRatios {
        return { ...this._capturedRatios };
    }

    // ── Angle Smoothing ─────────────────────────────────────────

    /**
     * Compute a smoothed joint angle from left/right measurements.
     * Selects the more visible side (or averages if equal), then applies
     * an adaptive One Euro Filter (replaces the old 3-frame sliding window).
     */
    protected smoothAngle(
        leftAngle: number, rightAngle: number,
        leftVis: number, rightVis: number,
    ): number {
        // Weighted average by visibility — avoids discontinuities when switching sides
        const MIN_SIDE_VIS = 0.8; // elbow+wrist visibility sum threshold
        let angle: number;
        if (leftVis >= MIN_SIDE_VIS && rightVis >= MIN_SIDE_VIS) {
            const total = leftVis + rightVis;
            angle = (leftAngle * leftVis + rightAngle * rightVis) / total;
        } else if (leftVis >= MIN_SIDE_VIS) {
            angle = leftAngle;
        } else if (rightVis >= MIN_SIDE_VIS) {
            angle = rightAngle;
        } else {
            const total = leftVis + rightVis;
            angle = total > 0
                ? (leftAngle * leftVis + rightAngle * rightVis) / total
                : (leftAngle + rightAngle) / 2;
        }

        return this._angleSmoother.filter(angle, Date.now() / 1000);
    }

    // ── Calibration Orchestration ───────────────────────────────

    /**
     * Track calibration progress. Call each frame with whether the current
     * position is valid for calibration.
     *
     * @param isPositionValid  Exercise-specific positional check
     * @param hasExistingProfile  If true, calibration completes 2× faster
     * @returns `'collecting'` while gathering frames, `'completed'` on the
     *          frame that hits the threshold, `'invalid'` if position lost.
     */
    protected updateCalibrationProgress(
        isPositionValid: boolean,
        hasExistingProfile: boolean,
    ): 'collecting' | 'completed' | 'invalid' {
        if (!isPositionValid) {
            this.calibrationFrameCount = 0;
            this.state.calibratingPercentage = 0;
            this.state.isValidPosition = false;
            return 'invalid';
        }

        this.calibrationFrameCount++;
        const framesNeeded = hasExistingProfile
            ? Math.round(CALIBRATION_FRAMES_REQUIRED / 2)
            : CALIBRATION_FRAMES_REQUIRED;
        this.state.calibratingPercentage = Math.min(
            100,
            Math.round((this.calibrationFrameCount / framesNeeded) * 100),
        );

        if (this.calibrationFrameCount >= framesNeeded) {
            this.state.isCalibrated = true;
            this.state.isValidPosition = true;
            return 'completed';
        }
        return 'collecting';
    }

    // ── Post-Calibration Guards ─────────────────────────────────

    /**
     * Run standard post-calibration checks: bounding box lock + landmark visibility.
     * Sets `isValidPosition = false` and returns `false` if the frame should be skipped.
     */
    protected checkPostCalibrationGuards(landmarks: Landmark[], keyIndices: number[]): boolean {
        if (!this.isWithinLockedRegion(landmarks)) {
            this.state.isValidPosition = false;
            return false;
        }
        if (!this.areLandmarksVisible(landmarks, keyIndices, 0.6)) {
            this.state.isValidPosition = false;
            return false;
        }
        return true;
    }

    // ── Rep Tracking ────────────────────────────────────────────

    /** Reset per-rep tracking state after a rep is recorded. */
    protected resetRepTracking(): void {
        this.minAngleThisRep = 180;
        this.bestAlignmentThisRep = -Infinity;
        this.hasReachedValidDown = false;
    }

    /**
     * Capture a dynamic calibration value (first N reps).
     * @param value  The metric to capture (min angle for pushup/squat, max rise for pullup)
     * @param mode   `'min'` to keep the smallest, `'max'` to keep the largest
     */
    protected captureDynamicCalibration(value: number, mode: 'min' | 'max'): void {
        this._dynamicValues.push(value);
        if (this._dynamicValues.length <= DYNAMIC_CAPTURE_REPS) {
            this._capturedRatios.dynamicCalibration =
                mode === 'min' ? Math.min(...this._dynamicValues) : Math.max(...this._dynamicValues);
        }
    }

    // ── Scoring Helpers ─────────────────────────────────────────

    /**
     * Linear interpolation score between two thresholds.
     * When `best < worst` (lower is better, e.g. min angle), returns 100 at `best` and 0 at `worst`.
     * When `best > worst` (higher is better, e.g. rise fraction), returns 100 at `best` and 0 at `worst`.
     */
    protected linearScore(value: number, worst: number, best: number): number {
        if (best < worst) {
            if (value <= best) return 100;
            if (value >= worst) return 0;
            return Math.round(((worst - value) / (worst - best)) * 100);
        }
        if (value >= best) return 100;
        if (value <= worst) return 0;
        return Math.round(((value - worst) / (best - worst)) * 100);
    }

    /** Composite rep score: 60% amplitude + 40% alignment */
    protected computeRepScore(amplitudeScore: number, alignmentScore: number): number {
        return Math.round(amplitudeScore * 0.6 + alignmentScore * 0.4);
    }

    // ── Angle-Based Phase Machine ───────────────────────────────
    // Template method for exercises that use simple angle thresholds
    // to detect up/down phases (pushup, squat). Pull-up uses a custom
    // dual-condition approach and does not use this method.

    /**
     * Common up/down/transition state machine for angle-threshold exercises.
     *
     * @param smoothedAngle  Current smoothed joint angle
     * @param angleUp        Threshold above which the phase is "up"
     * @param angleDown      Threshold below which the phase is "down"
     * @param isPositionValid Whether the body is in valid exercise position
     * @param minRepIntervalMs Minimum ms between reps (debounce)
     * @param onCountRep     Callback invoked when a rep should be counted.
     *                       Must return `{ amplitudeScore, alignmentScore, feedback }`.
     * @param onRepReset     Optional callback for detector-specific cleanup after rep tracking reset.
     */
    protected processAngleBasedPhase(
        smoothedAngle: number,
        angleUp: number,
        angleDown: number,
        _isPositionValid: boolean,
        minRepIntervalMs: number,
        onCountRep: (repDuration: number) => { amplitudeScore: number; alignmentScore: number; feedback: RepFeedback },
        onRepReset?: () => void,
    ): void {
        const prevPhase = this.state.currentPhase;
        this.state.incompleteRepFeedback = null;

        if (smoothedAngle >= angleUp) {
            this._downConfirmCount = 0;
            if (this.wasDescending && !this.hasReachedValidDown && this.minAngleThisRep < 170) {
                this.state.incompleteRepFeedback = 'go_lower';
            }
            this.wasDescending = false;

            if (this.hasReachedValidDown) {
                const now = Date.now();
                const repDuration = this.lastRepTimestamp > 0 ? now - this.lastRepTimestamp : 2000;
                if (repDuration >= minRepIntervalMs) {
                    const { amplitudeScore, alignmentScore, feedback } = onCountRep(repDuration);
                    const repScore = this.computeRepScore(amplitudeScore, alignmentScore);
                    this.lastRepTimestamp = now;
                    this.recordRep(repScore, amplitudeScore, alignmentScore, this.minAngleThisRep, feedback);
                    this.captureDynamicCalibration(this.minAngleThisRep, 'min');
                }
                this.resetRepTracking();
                onRepReset?.();
            }
            this.state.currentPhase = 'up';
        } else if (smoothedAngle <= angleDown) {
            this._downConfirmCount++;
            if (this._downConfirmCount >= 2) {
                this.hasReachedValidDown = true;
            }
            this.wasDescending = true;
            this.state.currentPhase = 'down';
        } else {
            if (prevPhase === 'up' || prevPhase === 'idle') this.wasDescending = true;
            this.state.currentPhase = 'transition';
        }
    }

    // ── Bounding Box Lock ───────────────────────────────────────

    protected computeBoundingBox(landmarks: Landmark[]): BoundingBox {
        const coreIndices = [11, 12, 23, 24];
        const coreLandmarks = coreIndices
            .map(i => landmarks[i])
            .filter(lm => lm && (lm.visibility ?? 0) > 0.3);

        const pts = coreLandmarks.length >= 3
            ? coreLandmarks
            : landmarks.filter(lm => lm && (lm.visibility ?? 0) > 0.3);

        if (pts.length === 0) {
            return { centerX: 0.5, centerY: 0.5, width: 0.5, height: 0.5 };
        }

        let minX = 1, maxX = 0, minY = 1, maxY = 0;
        for (const p of pts) {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        }

        return {
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2,
            width: maxX - minX,
            height: maxY - minY,
        };
    }

    protected lockBoundingBox(landmarks: Landmark[]): void {
        this.lockedBbox = this.computeBoundingBox(landmarks);
        this.bboxRejectStreak = 0;
    }

    protected isWithinLockedRegion(landmarks: Landmark[]): boolean {
        this.state.poseRejectedByLock = false;

        if (!this.lockedBbox) return true;

        const current = this.computeBoundingBox(landmarks);
        const locked = this.lockedBbox;

        const dCenterX = Math.abs(current.centerX - locked.centerX);
        const dCenterY = Math.abs(current.centerY - locked.centerY);
        const centerOk = dCenterX < BBOX_CENTER_TOLERANCE && dCenterY < BBOX_CENTER_TOLERANCE;

        const widthRatio = locked.width > 0 ? current.width / locked.width : 1;
        const heightRatio = locked.height > 0 ? current.height / locked.height : 1;
        const sizeOk =
            widthRatio > (1 - BBOX_SIZE_TOLERANCE) && widthRatio < (1 + BBOX_SIZE_TOLERANCE) &&
            heightRatio > (1 - BBOX_SIZE_TOLERANCE) && heightRatio < (1 + BBOX_SIZE_TOLERANCE);

        if (centerOk && sizeOk) {
            this.bboxRejectStreak = 0;
            const a = BBOX_ADAPT_RATE;
            this.lockedBbox = {
                centerX: locked.centerX * (1 - a) + current.centerX * a,
                centerY: locked.centerY * (1 - a) + current.centerY * a,
                width: locked.width * (1 - a) + current.width * a,
                height: locked.height * (1 - a) + current.height * a,
            };
            return true;
        }

        this.bboxRejectStreak++;
        this.state.poseRejectedByLock = true;

        if (this.bboxRejectStreak > BBOX_ADAPT_AFTER_FRAMES) {
            const a = BBOX_ADAPT_RATE * 0.5;
            this.lockedBbox = {
                centerX: locked.centerX * (1 - a) + current.centerX * a,
                centerY: locked.centerY * (1 - a) + current.centerY * a,
                width: locked.width * (1 - a) + current.width * a,
                height: locked.height * (1 - a) + current.height * a,
            };
        }

        return false;
    }

    // ── Utilities ────────────────────────────────────────────────

    protected computeAngle(a: Landmark, b: Landmark, c: Landmark): number {
        const radians =
            Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
        let angle = Math.abs((radians * 180.0) / Math.PI);
        if (angle > 180.0) angle = 360 - angle;
        return angle;
    }

    protected areLandmarksVisible(landmarks: Landmark[], indices: number[], minVisibility = 0.5): boolean {
        for (const idx of indices) {
            const lm = landmarks[idx];
            if (!lm || (lm.visibility ?? 0) < minVisibility) return false;
        }
        return true;
    }

    /**
     * Check if core landmarks form a plausible human body.
     * Rejects "exploded" hallucinated skeletons where core landmarks are incoherently spread.
     * Same check as the PoseOverlay — but applied BEFORE exercise detection.
     */
    protected areLandmarksPlausible(landmarks: Landmark[]): boolean {
        const MIN_VIS = 0.5;
        const core = [11, 12, 23, 24]
            .map(i => landmarks[i])
            .filter(l => l && (l.visibility ?? 0) > MIN_VIS);
        if (core.length < 3) return false;
        const xs = core.map(l => l.x), ys = core.map(l => l.y);
        const spanX = Math.max(...xs) - Math.min(...xs);
        const spanY = Math.max(...ys) - Math.min(...ys);
        return !(spanX > 0.6 || spanY > 0.6 || (spanX < 0.01 && spanY < 0.01));
    }

    /** Median of values — robust against outlier frames during calibration. */
    protected medianOf(values: number[]): number {
        if (values.length === 0) return 0;
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    /** Shared scaffolding for each detector's finalizeCalibration: builds `med`, runs the capture callback, then locks the bbox. */
    protected finalizeCalibrationLifecycle<F>(
        frames: F[],
        landmarks: Landmark[],
        capture: (med: (extractor: (f: F) => number) => number) => void,
    ): void {
        const med = (extractor: (f: F) => number) => this.medianOf(frames.map(extractor));
        capture(med);
        this.lockBoundingBox(landmarks);
    }

    protected recordRep(score: number, amplitudeScore: number, alignmentScore: number, minAngle: number, feedback: RepFeedback = 'good'): void {
        const repResult = { score, amplitudeScore, alignmentScore, minAngle, feedback };
        this.state.repHistory.push(repResult);
        this.state.lastRepResult = repResult;
        this.state.repCount += 1;
        const total = this.state.repHistory.reduce((sum, r) => sum + r.score, 0);
        this.state.averageScore = Math.round(total / this.state.repHistory.length);
    }
}
