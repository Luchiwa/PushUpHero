import { useRef, useState, useCallback } from 'react';
import { BaseExerciseDetector } from '../exercises/BaseExerciseDetector';
import type { ExerciseState, Landmark } from '../exercises/types';


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
    detectorRef.current = detector;

    /**
     * Called directly from the pose detection loop — no React re-render unless
     * the exercise state actually changes (rep counted, phase change, etc.)
     */
    const processLandmarks = useCallback((landmarks: Landmark[]) => {
        if (!isActive || landmarks.length === 0) return;
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
    }, [isActive]);

    const resetDetector = useCallback(() => {
        detectorRef.current.reset();
        setExerciseState(detectorRef.current.getState());
    }, []);

    return { exerciseState, processLandmarks, resetDetector };
}
