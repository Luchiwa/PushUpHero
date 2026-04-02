import type { ExerciseState, Landmark, RepFeedback } from './types';
import type { BodyProfile } from '@lib/bodyProfile';
import { CALIBRATION_FRAMES_REQUIRED } from '@lib/constants';

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

/** Number of frames to smooth the angle signal */
const SMOOTHING_WINDOW = 5;
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

    // ── Angle smoothing ─────────────────────────────────────────
    private _angleHistory: number[] = [];

    // ── Calibration ─────────────────────────────────────────────
    protected calibrationFrameCount = 0;

    // ── Rep tracking (common across all detectors) ──────────────
    protected minAngleThisRep = 180;
    protected bestAlignmentThisRep = -Infinity;
    protected hasReachedValidDown = false;
    protected lastRepTimestamp = 0;
    protected wasDescending = false;
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
        this._angleHistory = [];
        this.calibrationFrameCount = 0;
        this.minAngleThisRep = 180;
        this.bestAlignmentThisRep = -Infinity;
        this.hasReachedValidDown = false;
        this.lastRepTimestamp = 0;
        this.wasDescending = false;
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
     * a sliding-window smooth.
     */
    protected smoothAngle(
        leftAngle: number, rightAngle: number,
        leftVis: number, rightVis: number,
    ): number {
        let angle: number;
        if (leftVis > rightVis) angle = leftAngle;
        else if (rightVis > leftVis) angle = rightAngle;
        else angle = (leftAngle + rightAngle) / 2;

        this._angleHistory.push(angle);
        if (this._angleHistory.length > SMOOTHING_WINDOW) this._angleHistory.shift();
        return this._angleHistory.reduce((s, v) => s + v, 0) / this._angleHistory.length;
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
        if (!this.areLandmarksVisible(landmarks, keyIndices, 0.4)) {
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

    protected recordRep(score: number, amplitudeScore: number, alignmentScore: number, minAngle: number, feedback: RepFeedback = 'good'): void {
        const repResult = { score, amplitudeScore, alignmentScore, minAngle, feedback };
        this.state.repHistory.push(repResult);
        this.state.lastRepResult = repResult;
        this.state.repCount += 1;
        const total = this.state.repHistory.reduce((sum, r) => sum + r.score, 0);
        this.state.averageScore = Math.round(total / this.state.repHistory.length);
    }
}
