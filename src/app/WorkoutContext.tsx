/**
 * WorkoutContext — Provides the full workout state machine + exercise info
 * to any screen/overlay, eliminating prop drilling through App.tsx.
 *
 * The shape is declared **here** as an explicit interface (not derived from
 * `ReturnType<typeof useWorkoutStateMachine>`) so internal hook refactors
 * stay invisible to consumers. Every field a consumer reads is contracted.
 *
 * Provider lives in App.tsx. Consumers call `useWorkout()`.
 */
import { createContext, useContext } from 'react';
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import type {
    ExerciseType,
    SetRecord,
    TimeDuration,
    WorkoutBlock,
    WorkoutPlan,
} from '@exercises/types';
import type { Level, QuestDef, SessionXpResult } from '@domain';
import type { SaveSessionResult } from '@services/sessionService';
import type { AppScreen, SessionMode } from './workout/workoutTypes';

export interface WorkoutContextType {
    // ── Screen state ──
    screen: AppScreen;
    currentBlockIndex: number;
    currentSetIndex: number;

    // ── Session config ──
    goalReps: number;
    setGoalReps: Dispatch<SetStateAction<number>>;
    sessionMode: SessionMode;
    setSessionMode: Dispatch<SetStateAction<SessionMode>>;
    timeGoal: TimeDuration;
    setTimeGoal: Dispatch<SetStateAction<TimeDuration>>;
    soundEnabled: boolean;
    setSoundEnabled: Dispatch<SetStateAction<boolean>>;

    // ── Workout plan ──
    workoutPlan: WorkoutPlan;
    setWorkoutPlan: Dispatch<SetStateAction<WorkoutPlan>>;
    currentBlock: WorkoutBlock;
    completedSets: SetRecord[];
    completedSetsReps: number;
    isMultiSet: boolean;
    isMultiExercise: boolean;
    totalSetsInBlock: number;
    totalBlocks: number;
    totalSetsAllBlocks: number;
    flatSetIndex: number;
    activeExerciseType: ExerciseType;

    // ── Level & XP ──
    liveLevel: Level;
    levelBefore: Level;
    savedLevel: Level | null;
    lastSessionXp: (SessionXpResult & Partial<SaveSessionResult>) | null;
    goalReached: boolean;
    questCompletedThisSession: QuestDef[];
    activeQuest: QuestDef | null;

    // ── Timing ──
    elapsedTime: number;
    elapsedTimeRef: MutableRefObject<number>;

    // ── Handlers ──
    handleStart: (exerciseTypeOverride?: ExerciseType) => void;
    handleOpenConfig: () => void;
    handleWorkoutStart: () => void;
    handleBackToIdle: () => void;
    handleStop: () => void;
    handleTimerEnd: () => void;
    handleRestComplete: () => void;
    handleExerciseRestComplete: () => void;
    handleSkipBlock: () => void;
    handleReset: () => void;
    handleLevelUpContinue: () => void;
    handleResumeWorkout: () => void;
    handleDiscardCheckpoint: () => void;

    // ── Exercise type (owned by App.tsx, synced into block 0) ──
    exerciseType: ExerciseType;
    /** Combined setter: updates local exerciseType + syncs workoutPlan block 0 */
    changeExerciseType: (type: ExerciseType) => void;
}

/**
 * Subset of WorkoutContextType that the workout state machine produces.
 * The remaining fields (`exerciseType`, `changeExerciseType`) are owned
 * by App.tsx and merged in at the Provider boundary.
 */
export type WorkoutMachineReturn = Omit<WorkoutContextType, 'exerciseType' | 'changeExerciseType'>;

export const WorkoutContext = createContext<WorkoutContextType | null>(null);

export function useWorkout(): WorkoutContextType {
    const ctx = useContext(WorkoutContext);
    if (!ctx) throw new Error('useWorkout must be used within WorkoutContext.Provider');
    return ctx;
}
