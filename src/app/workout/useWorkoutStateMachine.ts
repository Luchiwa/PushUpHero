/**
 * useWorkoutStateMachine — Thin orchestrator.
 *
 * Composes useWorkoutMachineCore (reducer + plan + session + simple
 * dispatch handlers) and useWorkoutExecution (side-effect handlers, refs,
 * sound, effects), then recomposes the 37-property public API consumed
 * by WorkoutContext. App.tsx wires camera/pose/exercise-type around it.
 */
import type { ExerciseState, ExerciseType } from '@exercises/types';
import type { QuestDef, QuestProgress } from '@domain/quests';
import type { BodyProfile } from '@domain/bodyProfile';
import type { CapturedRatios } from '@exercises/BaseExerciseDetector';
import type { WorkoutMachineReturn } from '../WorkoutContext';
import { useWorkoutMachineCore } from './useWorkoutMachineCore';
import { useWorkoutExecution } from './useWorkoutExecution';

export { durationToSeconds } from './workoutTypes';
export type { AppScreen, SessionMode } from './workoutTypes';

interface UseWorkoutStateMachineProps {
    exerciseState: ExerciseState;
    resetDetector: () => void;
    startCamera: (mode?: 'user' | 'environment') => void;
    onExerciseTypeChange: (type: ExerciseType) => void;
    activeQuest: QuestDef | null;
    availableQuests: QuestDef[];
    questProgress: QuestProgress;
    bodyProfile: BodyProfile;
    onSaveBodyProfile: (profile: BodyProfile) => void;
    onCompleteQuests: (questIds: string[]) => void;
    onAddProgress: (questId: string, contribution: number) => number;
    getCapturedRatios: () => CapturedRatios;
}

export function useWorkoutStateMachine({
    exerciseState,
    resetDetector,
    startCamera,
    onExerciseTypeChange,
    activeQuest,
    availableQuests,
    questProgress,
    bodyProfile,
    onSaveBodyProfile,
    onCompleteQuests,
    onAddProgress,
    getCapturedRatios,
}: UseWorkoutStateMachineProps): WorkoutMachineReturn {
    const core = useWorkoutMachineCore({
        exerciseState,
        availableQuests,
        questProgress,
        bodyProfile,
        onSaveBodyProfile,
        onCompleteQuests,
        onAddProgress,
        getCapturedRatios,
    });

    const exec = useWorkoutExecution({
        core,
        exerciseState,
        resetDetector,
        startCamera,
        onExerciseTypeChange,
    });

    const { state, plan, session, currentSetReps: _csr, elapsedTimeRef, handleOpenConfig, handleBackToIdle } = core;
    void _csr;

    return {
        // ── Screen ──
        screen: state.screen,
        // ── Session config (setters routed through execution wrappers) ──
        goalReps: plan.goalReps, setGoalReps: exec.setGoalReps,
        sessionMode: plan.sessionMode, setSessionMode: exec.setSessionMode,
        timeGoal: plan.timeGoal, setTimeGoal: exec.setTimeGoal,
        soundEnabled: plan.soundEnabled, setSoundEnabled: plan.setSoundEnabled,
        // ── Workout plan ──
        workoutPlan: plan.workoutPlan, setWorkoutPlan: plan.setWorkoutPlan,
        currentBlock: plan.currentBlock,
        currentBlockIndex: state.currentBlockIndex, currentSetIndex: state.currentSetIndex,
        completedSets: state.completedSets, completedSetsReps: state.completedSetsReps,
        isMultiSet: plan.isMultiSet, isMultiExercise: plan.isMultiExercise,
        totalSetsInBlock: plan.totalSetsInBlock, totalBlocks: plan.totalBlocks,
        totalSetsAllBlocks: plan.totalSetsAllBlocks,
        flatSetIndex: plan.flatSetIndex,
        activeExerciseType: plan.activeExerciseType,
        // ── Level & XP ──
        liveLevel: session.liveLevel, liveProgressPct: session.liveProgressPct,
        levelBefore: session.levelBefore,
        savedLevel: session.savedLevel,
        lastSessionXp: session.lastSessionXp,
        goalReached: state.goalReached,
        questCompletedThisSession: session.questCompletedThisSession,
        activeQuest,
        // ── Timing ──
        elapsedTime: state.elapsedTime, elapsedTimeRef,
        // ── Handlers ──
        handleStart: exec.handleStart,
        handleOpenConfig,
        handleWorkoutStart: exec.handleWorkoutStart,
        handleBackToIdle,
        handleStop: exec.handleStop,
        handleTimerEnd: exec.handleTimerEnd,
        handleRestComplete: exec.handleRestComplete,
        handleExerciseRestComplete: exec.handleExerciseRestComplete,
        handleSkipBlock: exec.handleSkipBlock,
        handleReset: exec.handleReset,
        handleLevelUpContinue: exec.handleLevelUpContinue,
        handleResumeWorkout: exec.handleResumeWorkout,
        handleDiscardCheckpoint: exec.handleDiscardCheckpoint,
    };
}
