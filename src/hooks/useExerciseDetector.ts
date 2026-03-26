import { useRef, useState, useCallback, useEffect } from 'react';
import type { BaseExerciseDetector } from '@exercises/BaseExerciseDetector';
import type { CapturedRatios } from '@exercises/BaseExerciseDetector';
import type { ExerciseState, Landmark } from '@exercises/types';
import type { BodyProfile } from '@lib/bodyProfile';


interface UseExerciseDetectorProps {
    detector: BaseExerciseDetector;
    isActive: boolean;
    bodyProfile?: BodyProfile | null;
}

export function useExerciseDetector({
    detector,
    isActive,
    bodyProfile,
}: UseExerciseDetectorProps) {
    const [exerciseState, setExerciseState] = useState<ExerciseState>(
        detector.getState()
    );
    const detectorRef = useRef(detector);
    useEffect(() => { detectorRef.current = detector; }, [detector]);

    // Inject body profile into the detector whenever it changes
    useEffect(() => {
        detectorRef.current.setBodyProfile(bodyProfile ?? null);
    }, [bodyProfile]);

    // Keep isActive in a ref so processLandmarks always reads the latest value
    // without needing to be re-created (avoids circular-dependency issues).
    const isActiveRef = useRef(isActive);
    useEffect(() => { isActiveRef.current = isActive; }, [isActive]);

    /**
     * Called directly from the pose detection loop — no React re-render unless
     * the exercise state actually changes (rep counted, phase change, etc.)
     */
    const processLandmarks = useCallback((landmarks: Landmark[]) => {
        if (!isActiveRef.current || landmarks.length === 0) return;
        const newState = detectorRef.current.processPose(landmarks);
        setExerciseState(prev => {
            // Only re-render when something meaningful changes
            if (
                prev.repCount === newState.repCount &&
                prev.currentPhase === newState.currentPhase &&
                prev.isValidPosition === newState.isValidPosition &&
                prev.isCalibrated === newState.isCalibrated &&
                prev.poseRejectedByLock === newState.poseRejectedByLock &&
                Math.round(prev.calibratingPercentage) === Math.round(newState.calibratingPercentage) &&
                Math.round(prev.averageScore) === Math.round(newState.averageScore)
            ) {
                return prev;
            }
            return { ...newState };
        });
    }, []);

    const resetDetector = useCallback(() => {
        detectorRef.current.reset();
        setExerciseState(detectorRef.current.getState());
    }, []);

    /** Retrieve body profile ratios captured by the detector (call after calibration + reps) */
    const getCapturedRatios = useCallback((): CapturedRatios => {
        return detectorRef.current.getCapturedRatios();
    }, []);

    return { exerciseState, processLandmarks, resetDetector, getCapturedRatios };
}
