/**
 * useWorkoutSession — Slim orchestrator for the per-session save flow.
 *
 * Wires four pieces : useWorkoutSave (Firestore + guard), useQuestEvaluation
 * (per-session quest completion), maybeCaptureBodyProfile (body-profile patch),
 * and the live XP projection. Public surface unchanged so useWorkoutStateMachine
 * keeps its existing call site.
 */
import { useCallback } from 'react';
import type { Dispatch } from 'react';
import type { ExerciseType, SetRecord, WorkoutBlock, WorkoutPlan } from '@exercises/types';
import type { CapturedRatios } from '@exercises/BaseExerciseDetector';
import { useLevel } from '@hooks/useAuth';
import { projectLiveXp } from '@domain/xpSystem';
import type { SessionXpResult } from '@domain/xpSystem';
import type { SaveSessionResult } from '@services/sessionService';
import type { QuestDef, QuestProgress } from '@domain/quests';
import type { BodyProfile } from '@domain/bodyProfile';
import type { WorkoutAction } from './workoutReducer';
import { useWorkoutSave } from './useWorkoutSave';
import { useQuestEvaluation } from './useQuestEvaluation';
import { maybeCaptureBodyProfile } from './bodyProfileCapture';

interface UseWorkoutSessionProps {
    workoutPlan: WorkoutPlan;
    currentBlock: WorkoutBlock;
    isMultiExercise: boolean;
    completedSets: SetRecord[];
    activeExerciseType: ExerciseType;
    currentSetReps: number;
    workoutStartTimeRef: React.MutableRefObject<number>;
    availableQuests: QuestDef[];
    questProgress: QuestProgress;
    bodyProfile: BodyProfile;
    onSaveBodyProfile: (profile: BodyProfile) => void;
    onCompleteQuests: (questIds: string[]) => void;
    onAddProgress: (questId: string, contribution: number) => number;
    getCapturedRatios: () => CapturedRatios;
    dispatch: Dispatch<WorkoutAction>;
}

export interface UseWorkoutSessionReturn {
    lastSessionXp: (SessionXpResult & Partial<SaveSessionResult>) | null;
    questCompletedThisSession: QuestDef[];
    savedLevel: number | null;
    levelBefore: number;
    saveWorkoutSession: (allSets: SetRecord[]) => void;
    resetSessionState: () => void;
    liveLevel: number;
    liveProgressPct: number;
}

export function useWorkoutSession(props: UseWorkoutSessionProps): UseWorkoutSessionReturn {
    const {
        workoutPlan, currentBlock, isMultiExercise, completedSets, activeExerciseType,
        currentSetReps, workoutStartTimeRef, availableQuests, questProgress, bodyProfile,
        onSaveBodyProfile, onCompleteQuests, onAddProgress, getCapturedRatios, dispatch,
    } = props;

    const { totalXp } = useLevel();
    const { liveLevel, liveProgressPct } = projectLiveXp(
        totalXp, completedSets, currentSetReps, activeExerciseType,
    );

    const saveCtl = useWorkoutSave({
        workoutPlan, currentBlock, isMultiExercise, workoutStartTimeRef, dispatch,
    });
    const questCtl = useQuestEvaluation({
        availableQuests, questProgress, onCompleteQuests, onAddProgress,
    });

    const saveWorkoutSession = useCallback((allSets: SetRecord[]) => {
        void saveCtl.save(allSets).then(outcome => {
            if (!outcome) return;
            const completedQuests = questCtl.evaluate({
                totalReps: outcome.totalReps,
                avgScore: outcome.avgScore,
                exerciseType: outcome.primaryExercise,
                isMultiSet: outcome.isMultiSet,
                isMultiExercise: outcome.hasMultipleExercises,
                repsByExercise: outcome.repsByType as Partial<Record<ExerciseType, number>>,
            });
            const updatedProfile = maybeCaptureBodyProfile({
                completedQuests,
                primaryExercise: outcome.primaryExercise,
                bodyProfile,
                getCapturedRatios,
            });
            if (updatedProfile) onSaveBodyProfile(updatedProfile);
        });
    }, [saveCtl, questCtl, bodyProfile, getCapturedRatios, onSaveBodyProfile]);

    const resetSessionState = useCallback(() => {
        saveCtl.resetSaveState(liveLevel);
        questCtl.resetQuestState();
    }, [saveCtl, questCtl, liveLevel]);

    return {
        lastSessionXp: saveCtl.lastSessionXp,
        questCompletedThisSession: questCtl.questCompletedThisSession,
        savedLevel: saveCtl.savedLevel,
        levelBefore: saveCtl.levelBefore,
        saveWorkoutSession,
        resetSessionState,
        liveLevel,
        liveProgressPct,
    };
}
