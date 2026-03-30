import type { ExerciseState, Landmark, RepFeedback } from './types';
import type { BodyProfile } from '@lib/bodyProfile';

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
// After calibration, the detector locks onto the user's body region.
// Subsequent frames whose bounding box deviates too far are rejected,
// preventing passers-by (e.g. in a gym) from hijacking the session.

/** Tolerance for center drift (fraction of frame). */
const BBOX_CENTER_TOLERANCE = 0.25;
/** Tolerance for size change (ratio — 0.45 = ±45%). */
const BBOX_SIZE_TOLERANCE = 0.45;
/** Number of consecutive rejected frames before the lock adapts slightly. */
const BBOX_ADAPT_AFTER_FRAMES = 90;
/** How much the lock drifts toward the current bbox per adaptation step. */
const BBOX_ADAPT_RATE = 0.05;

interface BoundingBox {
    centerX: number;
    centerY: number;
    width: number;
    height: number;
}

/**
 * Abstract base class for all exercise detectors.
 * Extend this class to implement push-ups, squats, pull-ups, etc.
 */
export abstract class BaseExerciseDetector {
    protected state: ExerciseState;
    protected _bodyProfile: BodyProfile | null = null;
    protected _capturedRatios: CapturedRatios = {};

    // ── Bounding Box Lock state ──────────────────────────────────
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

    /**
     * Process a new pose frame. Returns updated exercise state.
     */
    abstract processPose(landmarks: Landmark[]): ExerciseState;

    /**
     * Reset all state (called on "Try Again").
     */
    reset(): void {
        this.state = this.initialState();
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

    // ── Bounding Box Lock API ────────────────────────────────────

    /**
     * Compute a bounding box from the visible landmarks.
     * Uses shoulder + hip landmarks as the core body region.
     * Falls back to all landmarks if core ones aren't available.
     */
    protected computeBoundingBox(landmarks: Landmark[]): BoundingBox {
        // Core body landmarks: shoulders + hips (always visible for any exercise)
        const coreIndices = [11, 12, 23, 24]; // L/R shoulder, L/R hip
        const coreLandmarks = coreIndices
            .map(i => landmarks[i])
            .filter(lm => lm && (lm.visibility ?? 0) > 0.3);

        // If we have core landmarks, use them; otherwise fall back to all visible
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

    /**
     * Lock the bounding box at the end of calibration.
     * Call this from subclasses when `isCalibrated` flips to true.
     */
    protected lockBoundingBox(landmarks: Landmark[]): void {
        this.lockedBbox = this.computeBoundingBox(landmarks);
        this.bboxRejectStreak = 0;
    }

    /**
     * Check whether the current landmarks fall within the locked region.
     * If they don't match, sets `poseRejectedByLock = true` and returns false.
     * If no lock is active (pre-calibration), always returns true.
     *
     * Also implements slow drift adaptation: if the lock has been rejecting
     * for many consecutive frames, it nudges slightly toward the new bbox
     * to handle gradual repositioning (e.g. user shifting on their mat).
     */
    protected isWithinLockedRegion(landmarks: Landmark[]): boolean {
        this.state.poseRejectedByLock = false;

        if (!this.lockedBbox) return true;

        const current = this.computeBoundingBox(landmarks);
        const locked = this.lockedBbox;

        // Check center drift
        const dCenterX = Math.abs(current.centerX - locked.centerX);
        const dCenterY = Math.abs(current.centerY - locked.centerY);
        const centerOk = dCenterX < BBOX_CENTER_TOLERANCE && dCenterY < BBOX_CENTER_TOLERANCE;

        // Check size change (relative to locked size)
        const widthRatio = locked.width > 0 ? current.width / locked.width : 1;
        const heightRatio = locked.height > 0 ? current.height / locked.height : 1;
        const sizeOk =
            widthRatio > (1 - BBOX_SIZE_TOLERANCE) && widthRatio < (1 + BBOX_SIZE_TOLERANCE) &&
            heightRatio > (1 - BBOX_SIZE_TOLERANCE) && heightRatio < (1 + BBOX_SIZE_TOLERANCE);

        if (centerOk && sizeOk) {
            // Match — slowly adapt the lock to track minor drift
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

        // Mismatch — reject this frame
        this.bboxRejectStreak++;
        this.state.poseRejectedByLock = true;

        // If rejected for a long time, the user may have legitimately moved.
        // Nudge the lock slowly to avoid permanent lock-out.
        if (this.bboxRejectStreak > BBOX_ADAPT_AFTER_FRAMES) {
            const a = BBOX_ADAPT_RATE * 0.5; // slower adaptation during rejection
            this.lockedBbox = {
                centerX: locked.centerX * (1 - a) + current.centerX * a,
                centerY: locked.centerY * (1 - a) + current.centerY * a,
                width: locked.width * (1 - a) + current.width * a,
                height: locked.height * (1 - a) + current.height * a,
            };
        }

        return false;
    }

    /**
     * Utility: compute angle (degrees) at joint B given points A-B-C.
     */
    protected computeAngle(a: Landmark, b: Landmark, c: Landmark): number {
        const radians =
            Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
        let angle = Math.abs((radians * 180.0) / Math.PI);
        if (angle > 180.0) angle = 360 - angle;
        return angle;
    }

    /**
     * Utility: check that key landmarks have sufficient visibility.
     * MediaPipe hallucinates positions for off-screen body parts with
     * low visibility scores — we must reject those frames.
     */
    protected areLandmarksVisible(landmarks: Landmark[], indices: number[], minVisibility = 0.5): boolean {
        for (const idx of indices) {
            const lm = landmarks[idx];
            if (!lm || (lm.visibility ?? 0) < minVisibility) return false;
        }
        return true;
    }

    /**
     * Utility: record a rep result and update running average.
     */
    protected recordRep(score: number, amplitudeScore: number, alignmentScore: number, minAngle: number, feedback: RepFeedback = 'good'): void {
        const repResult = { score, amplitudeScore, alignmentScore, minAngle, feedback };
        this.state.repHistory.push(repResult);
        this.state.lastRepResult = repResult;
        this.state.repCount += 1;
        const total = this.state.repHistory.reduce((sum, r) => sum + r.score, 0);
        this.state.averageScore = Math.round(total / this.state.repHistory.length);
    }
}
