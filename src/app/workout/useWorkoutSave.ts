/**
 * useWorkoutSave — Owns the async session save lifecycle.
 *
 * Guards against double-save, dispatches SAVE_STARTED / SAVE_COMPLETED /
 * SAVE_FAILED to the workout reducer, persists the session via
 * useSessionHistory (Firestore for logged-in users, localStorage for
 * guests), and exposes the post-save metadata the orchestrator needs to
 * drive quest evaluation and body-profile capture.
 */
import { useState, useRef, useCallback } from 'react';
import type { Dispatch } from 'react';
import type { ExerciseType, SetRecord, WorkoutBlock, WorkoutPlan } from '@exercises/types';
import { useSessionHistory } from '@hooks/useSessionHistory';
import { useAuthCore, useLevel } from '@hooks/useAuth';
import { useFriends } from '@hooks/useFriends';
import type { SessionXpResult } from '@domain/xpSystem';
import type { SaveSessionResult } from '@services/sessionService';
import type { WorkoutAction } from './workoutReducer';
import { durationToSeconds } from './workoutTypes';
import { computeFinalXp, derivePrimaryExercise } from './xpProjection';

export interface SaveOutcome {
    primaryExercise: ExerciseType;
    repsByType: Record<string, number>;
    totalReps: number;
    avgScore: number;
    hasMultipleExercises: boolean;
    isMultiSet: boolean;
}

interface UseWorkoutSaveProps {
    workoutPlan: WorkoutPlan;
    currentBlock: WorkoutBlock;
    isMultiExercise: boolean;
    workoutStartTimeRef: React.MutableRefObject<number>;
    dispatch: Dispatch<WorkoutAction>;
}

export interface UseWorkoutSaveReturn {
    lastSessionXp: (SessionXpResult & Partial<SaveSessionResult>) | null;
    savedLevel: number | null;
    levelBefore: number;
    save: (allSets: SetRecord[]) => Promise<SaveOutcome | null>;
    resetSaveState: (liveLevel: number) => void;
}

export function useWorkoutSave({
    workoutPlan,
    currentBlock,
    isMultiExercise,
    workoutStartTimeRef,
    dispatch,
}: UseWorkoutSaveProps): UseWorkoutSaveReturn {
    const { addSession } = useSessionHistory();
    const { dbUser } = useAuthCore();
    const { totalXp } = useLevel();
    const { friends } = useFriends();

    const [lastSessionXp, setLastSessionXp] = useState<(SessionXpResult & Partial<SaveSessionResult>) | null>(null);
    const [savedLevel, setSavedLevel] = useState<number | null>(null);
    const [levelBefore, setLevelBefore] = useState(0);
    const sessionSavedRef = useRef(false);

    const save = useCallback(async (allSets: SetRecord[]): Promise<SaveOutcome | null> => {
        if (sessionSavedRef.current) return null;
        const totalReps = allSets.reduce((sum, s) => sum + s.reps, 0);
        if (totalReps === 0) return null;

        sessionSavedRef.current = true;
        dispatch({ type: 'SAVE_STARTED' });

        const totalWorkoutDuration = Math.round((Date.now() - workoutStartTimeRef.current) / 1000);
        const { bonusCtx, avgScore, computedLevel } = computeFinalXp({
            allSets,
            totalWorkoutDuration,
            streak: dbUser?.streak ?? 0,
            isMultiExercise,
            totalXp,
        });
        setSavedLevel(computedLevel);

        const { primaryExercise, repsByType, hasMultipleExercises } = derivePrimaryExercise(allSets);
        const isMultiSet = allSets.length > 1;
        const restSeconds = isMultiExercise ? undefined : durationToSeconds(currentBlock.restBetweenSets);

        try {
            const result = await addSession({
                reps: totalReps,
                averageScore: avgScore,
                goalReps: allSets.reduce((sum, s) => sum + (s.goalReps ?? 0), 0),
                sessionMode: currentBlock.sessionMode,
                exerciseType: primaryExercise,
                elapsedTime: totalWorkoutDuration,
                numberOfSets: isMultiSet ? allSets.length : undefined,
                restDuration: isMultiSet ? restSeconds : undefined,
                sets: isMultiSet ? allSets : undefined,
                totalDuration: isMultiSet ? totalWorkoutDuration : undefined,
                blocks: hasMultipleExercises ? workoutPlan.blocks : undefined,
                isMultiExercise: hasMultipleExercises || undefined,
            }, bonusCtx, friends.length);

            setLastSessionXp(result);
            dispatch({ type: 'SAVE_COMPLETED' });
            return { primaryExercise, repsByType, totalReps, avgScore, hasMultipleExercises, isMultiSet };
        } catch (err) {
            console.error('Failed to save session:', err);
            sessionSavedRef.current = false;
            dispatch({ type: 'SAVE_FAILED' });
            return null;
        }
    }, [addSession, currentBlock, isMultiExercise, workoutPlan.blocks, totalXp, dbUser, friends.length, workoutStartTimeRef, dispatch]);

    const resetSaveState = useCallback((liveLevel: number) => {
        sessionSavedRef.current = false;
        setSavedLevel(null);
        setLevelBefore(liveLevel);
    }, []);

    return { lastSessionXp, savedLevel, levelBefore, save, resetSaveState };
}
