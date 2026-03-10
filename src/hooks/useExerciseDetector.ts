import { useEffect, useRef, useState } from 'react';
import { BaseExerciseDetector } from '../exercises/BaseExerciseDetector';
import type { ExerciseState, Landmark } from '../exercises/types';


interface UseExerciseDetectorProps {
    detector: BaseExerciseDetector;
    landmarks: Landmark[];
    isActive: boolean;
}

export function useExerciseDetector({
    detector,
    landmarks,
    isActive,
}: UseExerciseDetectorProps) {
    const [exerciseState, setExerciseState] = useState<ExerciseState>(
        detector.getState()
    );
    const detectorRef = useRef(detector);

    useEffect(() => {
        detectorRef.current = detector;
    }, [detector]);

    useEffect(() => {
        if (!isActive || landmarks.length === 0) return;
        const newState = detectorRef.current.processPose(landmarks);
        setExerciseState({ ...newState });
    }, [landmarks, isActive]);

    const resetDetector = () => {
        detectorRef.current.reset();
        setExerciseState(detectorRef.current.getState());
    };

    return { exerciseState, resetDetector };
}
