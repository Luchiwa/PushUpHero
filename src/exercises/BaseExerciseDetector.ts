import type { ExerciseState, Landmark, RepFeedback } from './types';

/**
 * Abstract base class for all exercise detectors.
 * Extend this class to implement push-ups, squats, pull-ups, etc.
 */
export abstract class BaseExerciseDetector {
    protected state: ExerciseState;

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
    }

    getState(): ExerciseState {
        return { ...this.state };
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
