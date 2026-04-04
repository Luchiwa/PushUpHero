/**
 * useWorkoutStateMachine — Thin orchestrator that composes:
 *   - workoutReducer  (explicit state machine for screen transitions)
 *   - useWorkoutPlan  (plan config, derived values, set building)
 *   - useWorkoutSession (async save, XP, quests, body profile)
 *
 * App.tsx only needs to wire camera/pose and render the JSX.
 * The public API (return object) is unchanged from the original monolith.
 */
import { useReducer, useRef, useEffect, useCallback } from 'react';
import { useRefSync } from '@hooks/shared/useRefSync';
import { useSoundEffect } from '@hooks/useSoundEffect';
import type { ExerciseState, ExerciseType, WorkoutBlock, SetRecord, TimeDuration } from '@exercises/types';
import { createDefaultBlock } from '@exercises/types';
import { warmUpSpeech } from '@infra/speechEngine';
import type { QuestDef } from '@domain/quests';
import type { BodyProfile } from '@domain/bodyProfile';
import type { CapturedRatios } from '@exercises/BaseExerciseDetector';
import { workoutReducer, INITIAL_WORKOUT_STATE } from './workoutReducer';
import { useWorkoutPlan } from './useWorkoutPlan';
import { useWorkoutSession } from './useWorkoutSession';

// Re-export types for backward compatibility
export { durationToSeconds } from './workoutTypes';
export type { AppScreen, SessionMode } from './workoutTypes';
import type { SessionMode } from './workoutTypes';

// ── Props ────────────────────────────────────────────────────────

interface UseWorkoutStateMachineProps {
  exerciseState: ExerciseState;
  resetDetector: () => void;
  startCamera: (mode?: 'user' | 'environment') => void;
  onExerciseTypeChange: (type: ExerciseType) => void;
  activeQuest: QuestDef | null;
  availableQuests: QuestDef[];
  bodyProfile: BodyProfile;
  onSaveBodyProfile: (profile: BodyProfile) => void;
  onCompleteQuests: (questIds: string[]) => void;
  getCapturedRatios: () => CapturedRatios;
}

// ── Hook ─────────────────────────────────────────────────────────

export function useWorkoutStateMachine({
  exerciseState,
  resetDetector,
  startCamera,
  onExerciseTypeChange,
  activeQuest,
  availableQuests,
  bodyProfile,
  onSaveBodyProfile,
  onCompleteQuests,
  getCapturedRatios,
}: UseWorkoutStateMachineProps) {
  // ── Reducer (screen transitions + progression indexes) ─────
  const [state, dispatch] = useReducer(workoutReducer, INITIAL_WORKOUT_STATE);

  // ── Plan (config, derived values, set building) ────────────
  const plan = useWorkoutPlan({
    exerciseState,
    currentBlockIndex: state.currentBlockIndex,
    currentSetIndex: state.currentSetIndex,
  });

  // ── Session (save, XP, quests, body profile) ───────────────
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
    bodyProfile,
    onSaveBodyProfile,
    onCompleteQuests,
    getCapturedRatios,
    dispatch,
  });

  // ── Sound ──────────────────────────────────────────────────
  const { initAudio, playLevelUpSound } = useSoundEffect();
  const prevLevelRef = useRef(0);

  // ── Elapsed time ref (for timer callbacks) ─────────────────
  const elapsedTimeRef = useRefSync(state.elapsedTime);

  // ── Refs for latest config values (avoids stale closures in handleStart) ──
  // We use wrapper setters that update the ref synchronously so handleStart
  // always reads the freshest value — even when called in the same event handler.
  const goalRepsRef = useRefSync(plan.goalReps);
  const sessionModeRef = useRefSync(plan.sessionMode);
  const timeGoalRef = useRefSync(plan.timeGoal);

  const { setGoalReps: planSetGoalReps, setSessionMode: planSetSessionMode, setTimeGoal: planSetTimeGoal } = plan;

  const setGoalReps = useCallback((v: number | ((prev: number) => number)) => {
    if (typeof v === 'function') {
      planSetGoalReps((prev) => {
        const next = v(prev);
        goalRepsRef.current = next;
        return next;
      });
    } else {
      goalRepsRef.current = v;
      planSetGoalReps(v);
    }
  }, [planSetGoalReps, goalRepsRef]);

  const setSessionMode = useCallback((v: SessionMode | ((prev: SessionMode) => SessionMode)) => {
    if (typeof v === 'function') {
      planSetSessionMode((prev) => {
        const next = v(prev);
        sessionModeRef.current = next;
        return next;
      });
    } else {
      sessionModeRef.current = v;
      planSetSessionMode(v);
    }
  }, [planSetSessionMode, sessionModeRef]);

  const setTimeGoal = useCallback((v: TimeDuration | ((prev: TimeDuration) => TimeDuration)) => {
    if (typeof v === 'function') {
      planSetTimeGoal((prev) => {
        const next = v(prev);
        timeGoalRef.current = next;
        return next;
      });
    } else {
      timeGoalRef.current = v;
      planSetTimeGoal(v);
    }
  }, [planSetTimeGoal, timeGoalRef]);

  // ── Handlers ───────────────────────────────────────────────

  const handleStart = useCallback((exerciseTypeOverride?: ExerciseType) => {
    if (state.isSaving) return;
    session.resetSessionState();
    plan.resetTimingRefs();
    warmUpSpeech();
    const resolvedExercise = exerciseTypeOverride ?? plan.workoutPlan.blocks[0]?.exerciseType ?? 'pushup';
    const block: WorkoutBlock = {
      ...createDefaultBlock(resolvedExercise),
      numberOfSets: 1,
      sessionMode: sessionModeRef.current,
      goalReps: goalRepsRef.current,
      timeGoal: timeGoalRef.current,
    };
    plan.setWorkoutPlan({ blocks: [block] });
    onExerciseTypeChange(block.exerciseType);
    startCamera();
    dispatch({ type: 'START_WORKOUT' });
  }, [state.isSaving, session, plan, onExerciseTypeChange, startCamera, sessionModeRef, goalRepsRef, timeGoalRef]);

  const handleOpenConfig = useCallback(() => {
    dispatch({ type: 'OPEN_CONFIG' });
  }, []);

  const handleWorkoutStart = useCallback(() => {
    if (state.isSaving) return;
    session.resetSessionState();
    plan.resetTimingRefs();
    warmUpSpeech();
    const firstBlock = plan.workoutPlan.blocks[0];
    plan.syncConfigFromBlock(firstBlock);
    onExerciseTypeChange(firstBlock.exerciseType);
    startCamera();
    dispatch({ type: 'START_WORKOUT' });
  }, [state.isSaving, session, plan, onExerciseTypeChange, startCamera]);

  const handleBackToIdle = useCallback(() => {
    dispatch({ type: 'BACK_TO_IDLE' });
  }, []);

  const handleSetComplete = useCallback(() => {
    const setRecord = plan.buildCurrentSetRecord();
    const totalReps = state.completedSets.reduce((sum, s) => sum + s.reps, 0) + setRecord.reps;
    const isLastSetInBlock = state.currentSetIndex >= plan.totalSetsInBlock - 1;
    const isLastBlock = state.currentBlockIndex >= plan.totalBlocks - 1;
    const elapsedTime = Math.round((Date.now() - plan.workoutStartTimeRef.current) / 1000);

    const goalReached =
      (plan.currentBlock.sessionMode === 'reps' && exerciseState.repCount >= plan.currentBlock.goalReps)
      || plan.currentBlock.sessionMode === 'time';

    if (isLastSetInBlock && isLastBlock && totalReps > 0) {
      session.saveWorkoutSession([...state.completedSets, setRecord]);
    }

    if (!isLastSetInBlock || !isLastBlock) {
      resetDetector();
    }

    dispatch({
      type: 'SET_COMPLETE',
      setRecord,
      isLastSetInBlock,
      isLastBlock,
      goalReached,
      elapsedTime,
      totalReps,
    });
  }, [plan, state.completedSets, state.currentSetIndex, state.currentBlockIndex, exerciseState.repCount, session, resetDetector]);

  const handleSetCompleteRef = useRefSync(handleSetComplete);

  const handleStop = useCallback(() => {
    const setRecord = plan.buildCurrentSetRecord();
    const allSets = [...state.completedSets, setRecord];
    const totalReps = allSets.reduce((sum, s) => sum + s.reps, 0);
    const elapsedTime = Math.round((Date.now() - plan.workoutStartTimeRef.current) / 1000);

    if (totalReps > 0) {
      session.saveWorkoutSession(allSets);
    }

    dispatch({ type: 'MANUAL_STOP', setRecord, elapsedTime, totalReps });
  }, [plan, state.completedSets, session]);

  const { workoutStartTimeRef, stampSetStartTime, syncConfigFromBlock } = plan;

  const handleTimerEnd = useCallback(() => {
    const elapsedTime = Math.round((Date.now() - workoutStartTimeRef.current) / 1000);
    dispatch({ type: 'TIMER_END', elapsedTime });
    handleSetCompleteRef.current();
  }, [workoutStartTimeRef, handleSetCompleteRef]);

  const handleRestComplete = useCallback(() => {
    resetDetector();
    stampSetStartTime();
    startCamera();
    dispatch({ type: 'REST_COMPLETE' });
  }, [resetDetector, startCamera, stampSetStartTime]);

  const handleExerciseRestComplete = useCallback(() => {
    resetDetector();
    const nextBlockIndex = state.currentBlockIndex + 1;
    const nextBlock = plan.workoutPlan.blocks[nextBlockIndex];
    stampSetStartTime();
    syncConfigFromBlock(nextBlock);
    onExerciseTypeChange(nextBlock.exerciseType);
    startCamera();
    dispatch({ type: 'EXERCISE_REST_COMPLETE', nextBlockIndex });
  }, [resetDetector, state.currentBlockIndex, plan.workoutPlan.blocks, stampSetStartTime, syncConfigFromBlock, onExerciseTypeChange, startCamera]);

  const handleSkipBlock = useCallback(() => {
    const remainingSets = plan.totalSetsInBlock - state.currentSetIndex;
    const skippedSets: SetRecord[] = Array.from({ length: remainingSets }, () => ({
      reps: 0,
      averageScore: 0,
      repHistory: [],
      duration: 0,
      setMode: plan.currentBlock.sessionMode,
      exerciseType: plan.currentBlock.exerciseType,
    }));
    const allSets = [...state.completedSets, ...skippedSets];
    const isLastBlock = state.currentBlockIndex >= plan.totalBlocks - 1;
    const elapsedTime = Math.round((Date.now() - workoutStartTimeRef.current) / 1000);
    const totalReps = allSets.reduce((sum, s) => sum + s.reps, 0);

    if (isLastBlock && totalReps > 0) {
      session.saveWorkoutSession(allSets);
    }

    if (!isLastBlock) {
      resetDetector();
    }

    dispatch({ type: 'SKIP_BLOCK', skippedSets, isLastBlock, elapsedTime, totalReps });
  }, [plan.totalSetsInBlock, plan.currentBlock, plan.totalBlocks, workoutStartTimeRef, state.completedSets, state.currentSetIndex, state.currentBlockIndex, session, resetDetector]);

  const handleReset = useCallback(() => {
    const effectiveLevel = session.savedLevel ?? session.liveLevel;
    if (effectiveLevel > session.levelBefore) {
      dispatch({ type: 'SHOW_LEVEL_UP' });
      return;
    }
    resetDetector();
    dispatch({ type: 'RESET_TO_IDLE' });
  }, [session.savedLevel, session.liveLevel, session.levelBefore, resetDetector]);

  const handleLevelUpContinue = useCallback(() => {
    resetDetector();
    dispatch({ type: 'RESET_TO_IDLE' });
  }, [resetDetector]);

  // ── Side effects ───────────────────────────────────────────

  // Level-up sound during active sessions
  useEffect(() => {
    if (state.screen === 'active' && session.liveLevel > prevLevelRef.current) {
      initAudio();
      if (plan.soundEnabled) playLevelUpSound();
    }
    prevLevelRef.current = session.liveLevel;
  }, [session.liveLevel, state.screen, plan.soundEnabled, playLevelUpSound, initAudio]);

  // Auto-complete set when rep goal reached
  useEffect(() => {
    if (
      state.screen === 'active'
      && plan.currentBlock.sessionMode === 'reps'
      && exerciseState.repCount >= plan.currentBlock.goalReps
    ) {
      handleSetCompleteRef.current();
    }
  }, [exerciseState.repCount, state.screen, plan.currentBlock.sessionMode, plan.currentBlock.goalReps, handleSetCompleteRef]);

  // ── Return (same API as original) ─────────────────────────
  return {
    // Screen
    screen: state.screen,
    // Session config
    goalReps: plan.goalReps, setGoalReps,
    sessionMode: plan.sessionMode, setSessionMode,
    timeGoal: plan.timeGoal, setTimeGoal,
    soundEnabled: plan.soundEnabled, setSoundEnabled: plan.setSoundEnabled,
    // Workout plan
    workoutPlan: plan.workoutPlan, setWorkoutPlan: plan.setWorkoutPlan,
    currentBlock: plan.currentBlock,
    currentBlockIndex: state.currentBlockIndex, currentSetIndex: state.currentSetIndex,
    completedSets: state.completedSets, completedSetsReps: state.completedSetsReps,
    isMultiSet: plan.isMultiSet, isMultiExercise: plan.isMultiExercise,
    totalSetsInBlock: plan.totalSetsInBlock, totalBlocks: plan.totalBlocks,
    totalSetsAllBlocks: plan.totalSetsAllBlocks,
    flatSetIndex: plan.flatSetIndex,
    activeExerciseType: plan.activeExerciseType,
    // Level & XP
    liveLevel: session.liveLevel, liveProgressPct: session.liveProgressPct,
    levelBefore: session.levelBefore,
    savedLevel: session.savedLevel,
    lastSessionXp: session.lastSessionXp,
    goalReached: state.goalReached,
    questCompletedThisSession: session.questCompletedThisSession,
    activeQuest,
    // Timing
    elapsedTime: state.elapsedTime, elapsedTimeRef,
    // Handlers
    handleStart, handleOpenConfig, handleWorkoutStart, handleBackToIdle,
    handleStop, handleTimerEnd,
    handleRestComplete, handleExerciseRestComplete,
    handleSkipBlock,
    handleReset, handleLevelUpContinue,
  };
}

/** Type helper — enables WorkoutContext to type-check without duplicating the interface. */
export type WorkoutMachineReturn = ReturnType<typeof useWorkoutStateMachine>;
