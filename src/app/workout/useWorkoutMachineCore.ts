/**
 * useWorkoutMachineCore — Mounts the reducer and the per-domain sub-hooks
 * (plan, session) and exposes the aggregate state that execution-side
 * handlers need to coordinate against.
 *
 * Owns nothing side-effectful : no camera, no detector, no checkpoint, no
 * sound. Just the screen state, derived plan/session bundles, and the
 * trivial dispatch-only handlers.
 */
import { useCallback, useReducer, type Dispatch } from 'react';
import { useRefSync } from '@hooks/shared/useRefSync';
import type { ExerciseState } from '@exercises/types';
import type { CapturedRatios } from '@exercises/BaseExerciseDetector';
import type { BodyProfile, QuestDef, QuestProgress } from '@domain';
import { INITIAL_WORKOUT_STATE, workoutReducer, type WorkoutAction, type WorkoutState } from './workoutReducer';
import { useWorkoutPlan, type UseWorkoutPlanReturn } from './useWorkoutPlan';
import { useWorkoutSession, type UseWorkoutSessionReturn } from './useWorkoutSession';

interface UseWorkoutMachineCoreProps {
    exerciseState: ExerciseState;
    availableQuests: QuestDef[];
    questProgress: QuestProgress;
    bodyProfile: BodyProfile;
    onSaveBodyProfile: (profile: BodyProfile) => void;
    onCompleteQuests: (questIds: string[]) => void;
    onAddProgress: (questId: string, contribution: number) => number;
    getCapturedRatios: () => CapturedRatios;
}

export interface UseWorkoutMachineCoreReturn {
    state: WorkoutState;
    dispatch: Dispatch<WorkoutAction>;
    plan: UseWorkoutPlanReturn;
    session: UseWorkoutSessionReturn;
    /** Latest elapsedTime mirrored into a ref for timer callbacks. */
    elapsedTimeRef: React.MutableRefObject<number>;
    handleOpenConfig: () => void;
    handleBackToIdle: () => void;
}

export function useWorkoutMachineCore({
    exerciseState,
    availableQuests,
    questProgress,
    bodyProfile,
    onSaveBodyProfile,
    onCompleteQuests,
    onAddProgress,
    getCapturedRatios,
}: UseWorkoutMachineCoreProps): UseWorkoutMachineCoreReturn {
    const [state, dispatch] = useReducer(workoutReducer, INITIAL_WORKOUT_STATE);

    const plan = useWorkoutPlan({
        exerciseState,
        currentBlockIndex: state.currentBlockIndex,
        currentSetIndex: state.currentSetIndex,
    });

    const currentSetReps = state.screen === 'active' ? exerciseState.repCount : 0;

    const session = useWorkoutSession({
        workoutPlan: plan.workoutPlan,
        currentBlock: plan.currentBlock,
        isMultiExercise: plan.isMultiExercise,
        completedSets: state.completedSets,
        activeExerciseType: plan.activeExerciseType,
        currentSetReps,
        workoutStartTimeRef: plan.workoutStartTimeRef,
        availableQuests,
        questProgress,
        bodyProfile,
        onSaveBodyProfile,
        onCompleteQuests,
        onAddProgress,
        getCapturedRatios,
        dispatch,
    });

    const elapsedTimeRef = useRefSync(state.elapsedTime);

    const handleOpenConfig = useCallback(() => {
        dispatch({ type: 'OPEN_CONFIG' });
    }, []);

    const handleBackToIdle = useCallback(() => {
        dispatch({ type: 'BACK_TO_IDLE' });
    }, []);

    return {
        state,
        dispatch,
        plan,
        session,
        elapsedTimeRef,
        handleOpenConfig,
        handleBackToIdle,
    };
}
