import type { RepFeedback } from '../types';
import { BaseExerciseDetector } from '../BaseExerciseDetector';

/**
 * Base for exercises whose rep is counted at the REST position (high angle):
 * push-ups, squats. Pull-up and leg-raise count at the PEAK and use a custom
 * phase machine — they extend `BaseExerciseDetector` directly instead.
 */
export abstract class AngleBasedExerciseDetector extends BaseExerciseDetector {
    /**
     * Common up/down/transition state machine for angle-threshold exercises.
     * Counts a rep at the UP transition (return to rest), debounced by
     * `minRepIntervalMs`, after the body has reached a valid DOWN.
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
}
