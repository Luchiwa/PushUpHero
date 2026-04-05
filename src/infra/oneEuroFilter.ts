/**
 * oneEuroFilter.ts
 *
 * One Euro Filter — adaptive low-pass filter for real-time signal smoothing.
 *
 * The legacy MediaPipe Pose solution included landmark smoothing internally
 * (smooth_landmarks option using a One Euro Filter). The newer Tasks SDK
 * removed it (see github.com/google/mediapipe/issues/4507), so we apply
 * it ourselves as a post-processing step.
 *
 * Tuned for exercise detection at 20-30fps:
 *   min_cutoff: 1.5 — moderate jitter reduction at rest (~24% new value per frame)
 *   beta: 0.5 — responsive to motion (cutoff increases with speed)
 *   derivate_cutoff: 1.0
 *
 * Note: MediaPipe's C++ defaults (min_cutoff=0.05, beta=80) are too aggressive
 * for our use case — they cause 200-300ms lag on phase transitions.
 */

import type { Landmark } from '@exercises/types';

export class OneEuroFilter {
    private readonly minCutoff: number;
    private readonly beta: number;
    private readonly dCutoff: number;
    private xPrev: number | null = null;
    private dxPrev = 0;
    private tPrev = 0;

    constructor(minCutoff = 1.5, beta = 0.5, dCutoff = 1.0) {
        this.minCutoff = minCutoff;
        this.beta = beta;
        this.dCutoff = dCutoff;
    }

    private alpha(cutoff: number, dt: number): number {
        const tau = 1.0 / (2 * Math.PI * cutoff);
        return 1.0 / (1.0 + tau / dt);
    }

    filter(x: number, t: number): number {
        if (this.xPrev === null) {
            this.xPrev = x;
            this.tPrev = t;
            return x;
        }

        const dt = Math.max(1e-6, t - this.tPrev);
        this.tPrev = t;

        // Smoothed derivative
        const dx = (x - this.xPrev) / dt;
        const aDx = this.alpha(this.dCutoff, dt);
        const dxFiltered = aDx * dx + (1 - aDx) * this.dxPrev;
        this.dxPrev = dxFiltered;

        // Adaptive cutoff: high speed → less smoothing (responsive)
        const cutoff = this.minCutoff + this.beta * Math.abs(dxFiltered);

        // Filtered value
        const a = this.alpha(cutoff, dt);
        const filtered = a * x + (1 - a) * this.xPrev;
        this.xPrev = filtered;

        return filtered;
    }

    reset(): void {
        this.xPrev = null;
        this.dxPrev = 0;
        this.tPrev = 0;
    }
}

/**
 * Smooths all 33 MediaPipe pose landmarks using per-dimension One Euro Filters.
 * Each landmark's x, y, z are filtered independently. Visibility is passed through
 * unfiltered (it's a confidence score, not a spatial signal).
 */
/**
 * Confidence-interpolated landmark smoother.
 *
 * Per-dimension One Euro Filters on x/y/z, plus confidence interpolation:
 * landmarks with low visibility are blended toward their last-known-good
 * position instead of being passed through raw (which causes jumps when
 * MediaPipe hallucinates positions for occluded joints).
 *
 * Visibility tiers:
 *   >= 0.5  → normal filtering, position saved as "last good"
 *   0.15–0.5 → interpolate current ↔ last good (weight = visibility / 0.5)
 *   < 0.15  → freeze at last good position (MediaPipe is hallucinating)
 */
export class LandmarkSmoother {
    private readonly filters: OneEuroFilter[];
    private lastGoodLandmarks: Landmark[] = [];

    /** Visibility above which landmarks are fully trusted */
    private static readonly HIGH_VIS = 0.5;
    /** Visibility below which landmarks are fully frozen */
    private static readonly LOW_VIS = 0.15;

    constructor(numLandmarks = 33) {
        this.filters = [];
        for (let i = 0; i < numLandmarks * 3; i++) {
            this.filters.push(new OneEuroFilter());
        }
    }

    /** Returns a new array of smoothed landmarks with confidence interpolation. */
    smooth(landmarks: Landmark[], timestampMs: number): Landmark[] {
        const t = timestampMs / 1000; // One Euro Filter works in seconds
        const result: Landmark[] = [];

        for (let i = 0; i < landmarks.length; i++) {
            const lm = landmarks[i];
            const b = i * 3;
            const vis = lm.visibility ?? 0;

            if (b + 2 >= this.filters.length) {
                result.push(lm);
                continue;
            }

            if (vis >= LandmarkSmoother.HIGH_VIS) {
                // High confidence: normal One Euro filtering, save as last good
                const smoothed: Landmark = {
                    x: this.filters[b].filter(lm.x, t),
                    y: this.filters[b + 1].filter(lm.y, t),
                    z: this.filters[b + 2].filter(lm.z, t),
                    visibility: lm.visibility,
                };
                this.lastGoodLandmarks[i] = smoothed;
                result.push(smoothed);

            } else if (vis >= LandmarkSmoother.LOW_VIS && this.lastGoodLandmarks[i]) {
                // Low confidence: blend current position toward last good
                const last = this.lastGoodLandmarks[i];
                const w = vis / LandmarkSmoother.HIGH_VIS; // 0 at LOW_VIS=0.15, 1 at HIGH_VIS=0.5
                const blended: Landmark = {
                    x: lm.x * w + last.x * (1 - w),
                    y: lm.y * w + last.y * (1 - w),
                    z: lm.z * w + last.z * (1 - w),
                    visibility: lm.visibility,
                };
                // Filter the blended position to maintain continuity
                result.push({
                    x: this.filters[b].filter(blended.x, t),
                    y: this.filters[b + 1].filter(blended.y, t),
                    z: this.filters[b + 2].filter(blended.z, t),
                    visibility: lm.visibility,
                });

            } else if (this.lastGoodLandmarks[i]) {
                // Very low confidence: freeze at last good position
                // Don't update the One Euro filter (would corrupt it with bad data)
                result.push({
                    ...this.lastGoodLandmarks[i],
                    visibility: lm.visibility,
                });

            } else {
                // No last good position yet: pass through with normal filtering
                const smoothed: Landmark = {
                    x: this.filters[b].filter(lm.x, t),
                    y: this.filters[b + 1].filter(lm.y, t),
                    z: this.filters[b + 2].filter(lm.z, t),
                    visibility: lm.visibility,
                };
                result.push(smoothed);
            }
        }
        return result;
    }

    reset(): void {
        for (const f of this.filters) f.reset();
        this.lastGoodLandmarks = [];
    }
}
