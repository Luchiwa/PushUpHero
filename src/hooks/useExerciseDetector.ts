import { useRef, useState, useCallback, useEffect } from 'react';
import type { BaseExerciseDetector } from '@exercises/BaseExerciseDetector';
import type { ExerciseState, Landmark } from '@exercises/types';


interface UseExerciseDetectorProps {
    detector: BaseExerciseDetector;
    isActive: boolean;
}

export function useExerciseDetector({
    detector,
    isActive,
}: UseExerciseDetectorProps) {
    const [exerciseState, setExerciseState] = useState<ExerciseState>(
        detector.getState()
    );
    const detectorRef = useRef(detector);
    useEffect(() => { detectorRef.current = detector; }, [detector]);

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

    return { exerciseState, processLandmarks, resetDetector };
}
