/**
 * useWorkoutStateMachine — Encapsulates the entire workout state machine:
 * screen transitions, multi-set + multi-exercise logic, session saving, level tracking.
 *
 * App.tsx only needs to wire camera/pose and render the JSX.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useSessionHistory } from '@hooks/useSessionHistory';
import { useAuth } from '@hooks/useAuth';
import { useFriends } from '@hooks/useFriends';
import { useSoundEffect } from '@hooks/useSoundEffect';
import { levelFromTotalXp, totalXpForLevel, calculateSessionXp } from '@lib/xpSystem';
import type { BonusContext, SessionXpResult } from '@lib/xpSystem';
import type { SaveSessionResult } from '@lib/userService';
import type { ExerciseState, ExerciseType, SetRecord, WorkoutBlock, WorkoutPlan, TimeDuration } from '@exercises/types';
import { createDefaultBlock } from '@exercises/types';

// ── Public types ────────────────────────────────────────────────
export type AppScreen = 'idle' | 'config' | 'active' | 'rest' | 'exercise-rest' | 'stopped' | 'levelup';
export type SessionMode = 'reps' | 'time';

export function durationToSeconds(d: TimeDuration): number {
  return d.minutes * 60 + d.seconds;
}

interface UseWorkoutStateMachineProps {
  exerciseState: ExerciseState;
  resetDetector: () => void;
  startCamera: (mode?: 'user' | 'environment') => void;
  /** Called when the active exercise type changes mid-workout (multi-exercise) */
  onExerciseTypeChange: (type: ExerciseType) => void;
}

export function useWorkoutStateMachine({
  exerciseState,
  resetDetector,
  startCamera,
  onExerciseTypeChange,
}: UseWorkoutStateMachineProps) {
  // ── Core state ──────────────────────────────────────────────────
  const [screen, setScreen] = useState<AppScreen>('idle');
  const [goalReps, setGoalReps] = useState(10);
  const [sessionMode, setSessionMode] = useState<SessionMode>('reps');
  const [timeGoal, setTimeGoal] = useState({ minutes: 0, seconds: 30 });
  const [soundEnabled, setSoundEnabled] = useState(true);

  const { addSession } = useSessionHistory();
  const { initAudio, playLevelUpSound } = useSoundEffect();
  const { totalXp, dbUser } = useAuth();
  const { friends } = useFriends();

  // ── Level tracking ──────────────────────────────────────────────
  const prevLevelRef = useRef(0);
  const [levelBefore, setLevelBefore] = useState(0);
  const savedLevelRef = useRef<number | null>(null);
  const elapsedTimeRef = useRef(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const sessionSavedRef = useRef(false);

  // ── Workout plan (multi-exercise) ──────────────────────────────
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan>({
    blocks: [createDefaultBlock('pushup')],
  });
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [completedSets, setCompletedSets] = useState<SetRecord[]>([]);
  const [completedSetsReps, setCompletedSetsReps] = useState(0);
  const setStartTimeRef = useRef(0);
  const workoutStartTimeRef = useRef(0);

  // ── Derived: current block config ───────────────────────────────
  const currentBlock = workoutPlan.blocks[currentBlockIndex]
    ?? workoutPlan.blocks[0]
    ?? createDefaultBlock('pushup');
  const isMultiExercise = workoutPlan.blocks.length > 1;
  const isMultiSet = currentBlock.numberOfSets > 1;
  const totalSetsInBlock = currentBlock.numberOfSets;
  const totalBlocks = workoutPlan.blocks.length;

  /** Total sets across all blocks (for summary) */
  const totalSetsAllBlocks = workoutPlan.blocks.reduce((sum, b) => sum + b.numberOfSets, 0);

  /** Flat set index across the entire workout (for progress display) */
  const flatSetIndex = workoutPlan.blocks
    .slice(0, currentBlockIndex)
    .reduce((sum, b) => sum + b.numberOfSets, 0) + currentSetIndex;

  // ── Active exercise type (from current block) ───────────────────
  const activeExerciseType = currentBlock.exerciseType;

  // ── Live level projection (XP-based) ─────────────────────────────────────
  const currentSetReps = screen === 'active' ? exerciseState.repCount : 0;
  const allSessionReps = completedSetsReps + currentSetReps;
  // Estimate live XP: approximate using average 10 XP/rep (Grade C baseline)
  // For accurate projection we'd need per-rep scores, but this is good enough for the ring
  const liveXpEstimate = totalXp + allSessionReps * 10;
  const liveLevel = levelFromTotalXp(liveXpEstimate);
  const liveLevelBase = totalXpForLevel(liveLevel);
  const liveLevelNext = totalXpForLevel(liveLevel + 1);
  const liveProgressPct = liveLevelNext > liveLevelBase
    ? ((liveXpEstimate - liveLevelBase) / (liveLevelNext - liveLevelBase)) * 100
    : 0;

  // ── Build a SetRecord from the current exerciseState ────────────
  const buildCurrentSetRecord = useCallback((): SetRecord => {
    const setDuration = Math.round((Date.now() - setStartTimeRef.current) / 1000);
    const record: SetRecord = {
      reps: exerciseState.repCount,
      averageScore: Math.round(exerciseState.averageScore),
      repHistory: [...exerciseState.repHistory],
      duration: setDuration,
      setMode: currentBlock.sessionMode,
      exerciseType: currentBlock.exerciseType,
    };
    if (currentBlock.sessionMode === 'reps') record.goalReps = currentBlock.goalReps;
    if (currentBlock.sessionMode === 'time') record.timeGoal = durationToSeconds(currentBlock.timeGoal);
    return record;
  }, [exerciseState, currentBlock]);

  // ── Save the entire workout as one session ──────────────────────
  /** Last session XP result + achievements for display on SummaryScreen */
  const [lastSessionXp, setLastSessionXp] = useState<(SessionXpResult & Partial<SaveSessionResult>) | null>(null);
  const [goalReached, setGoalReached] = useState(false);

  const saveWorkoutSession = useCallback((allSets: SetRecord[]) => {
    if (sessionSavedRef.current) return;
    const totalReps = allSets.reduce((sum, s) => sum + s.reps, 0);
    if (totalReps === 0) return;

    // Compute XP for level-up detection
    const streak = dbUser?.streak ?? 0;
    const totalWorkoutDuration = Math.round((Date.now() - workoutStartTimeRef.current) / 1000);
    const weightedScoreSum = allSets.reduce((sum, s) => sum + s.averageScore * s.reps, 0);
    const avgScore = totalReps > 0 ? Math.round(weightedScoreSum / totalReps) : 0;

    // Check if all goals were met
    const allGoalsMet = allSets.every(s => {
      if (s.setMode === 'time') return true; // time mode always counts as met
      return s.goalReps !== undefined ? s.reps >= s.goalReps : true;
    });

    const bonusCtx: BonusContext = {
      streak,
      elapsedTime: totalWorkoutDuration,
      averageScore: avgScore,
      allGoalsMet,
      isMultiExercise: isMultiExercise,
    };

    // Pre-calculate XP for level-up check
    const xpResult = calculateSessionXp(allSets, bonusCtx);
    const newTotalXp = totalXp + xpResult.totalXp;
    savedLevelRef.current = levelFromTotalXp(newTotalXp);
    sessionSavedRef.current = true;

    // Determine the primary exercise type (the one with the most reps, or first)
    const repsByType: Record<string, number> = {};
    for (const s of allSets) {
      const t = s.exerciseType ?? 'pushup';
      repsByType[t] = (repsByType[t] ?? 0) + s.reps;
    }
    const primaryExercise = (Object.entries(repsByType).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'pushup') as ExerciseType;
    const hasMultipleExercises = Object.keys(repsByType).length > 1;

    // For single-block workouts, use the block's rest config
    const restSeconds = isMultiExercise
      ? undefined
      : durationToSeconds(currentBlock.restBetweenSets);

    addSession({
      reps: totalReps,
      averageScore: avgScore,
      goalReps: allSets.reduce((sum, s) => sum + (s.goalReps ?? 0), 0),
      sessionMode: currentBlock.sessionMode,
      exerciseType: primaryExercise,
      elapsedTime: totalWorkoutDuration,
      numberOfSets: allSets.length > 1 ? allSets.length : undefined,
      restDuration: allSets.length > 1 ? restSeconds : undefined,
      sets: allSets.length > 1 ? allSets : undefined,
      totalDuration: allSets.length > 1 ? totalWorkoutDuration : undefined,
      blocks: hasMultipleExercises ? workoutPlan.blocks : undefined,
      isMultiExercise: hasMultipleExercises || undefined,
    }, bonusCtx, friends.length).then(result => {
      setLastSessionXp(result);
    }).catch(err => {
      console.error('Failed to save session:', err);
      sessionSavedRef.current = false;
    });
  }, [addSession, currentBlock, isMultiExercise, workoutPlan.blocks, totalXp, dbUser, friends.length]);

  // ── Start helpers ───────────────────────────────────────────────

  /** Reset all workout state for a fresh start */
  const resetWorkoutState = useCallback(() => {
    elapsedTimeRef.current = 0;
    sessionSavedRef.current = false;
    savedLevelRef.current = null;
    setLevelBefore(liveLevel);
    setCurrentBlockIndex(0);
    setCurrentSetIndex(0);
    setCompletedSets([]);
    setCompletedSetsReps(0);
    setStartTimeRef.current = Date.now();
    workoutStartTimeRef.current = Date.now();
  }, [liveLevel]);

  // ── Quick Start (single exercise, 1 set) ───────────────────────
  const handleStart = () => {
    resetWorkoutState();
    const block: WorkoutBlock = {
      ...createDefaultBlock(workoutPlan.blocks[0]?.exerciseType ?? 'pushup'),
      numberOfSets: 1,
      sessionMode,
      goalReps,
      timeGoal,
    };
    setWorkoutPlan({ blocks: [block] });
    onExerciseTypeChange(block.exerciseType);
    startCamera();
    setScreen('active');
  };

  const handleOpenConfig = () => {
    setScreen('config');
  };

  // ── Workout Start (from config screen) ──────────────────────────
  const handleWorkoutStart = () => {
    resetWorkoutState();
    const firstBlock = workoutPlan.blocks[0];
    setSessionMode(firstBlock.sessionMode);
    setGoalReps(firstBlock.goalReps);
    setTimeGoal(firstBlock.timeGoal);
    onExerciseTypeChange(firstBlock.exerciseType);
    startCamera();
    setScreen('active');
  };

  const handleBackToIdle = () => {
    setScreen('idle');
  };

  // ── Set / Block completion logic ────────────────────────────────

  const handleSetComplete = useCallback(() => {
    const setRecord = buildCurrentSetRecord();
    const newCompletedSets = [...completedSets, setRecord];
    setCompletedSets(newCompletedSets);
    setCompletedSetsReps(prev => prev + setRecord.reps);

    const isLastSetInBlock = currentSetIndex >= totalSetsInBlock - 1;
    const isLastBlock = currentBlockIndex >= totalBlocks - 1;

    if (isLastSetInBlock && isLastBlock) {
      // ── Entire workout finished ──
      const totalElapsed = Math.round((Date.now() - workoutStartTimeRef.current) / 1000);
      elapsedTimeRef.current = totalElapsed;
      setElapsedTime(totalElapsed);
      const totalReps = newCompletedSets.reduce((sum, s) => sum + s.reps, 0);

      if (totalReps === 0) {
        setScreen('idle');
      } else {
        const isGoalReached =
          (currentBlock.sessionMode === 'reps' && exerciseState.repCount >= currentBlock.goalReps)
          || currentBlock.sessionMode === 'time';
        setGoalReached(isGoalReached);
        saveWorkoutSession(newCompletedSets);
        setScreen('stopped');
      }
    } else if (isLastSetInBlock && !isLastBlock) {
      // ── Block finished, more blocks to go → exercise rest ──
      resetDetector();
      setScreen('exercise-rest');
    } else {
      // ── More sets in current block → set rest ──
      resetDetector();
      setScreen('rest');
    }
  }, [buildCurrentSetRecord, completedSets, currentSetIndex, totalSetsInBlock, currentBlockIndex, totalBlocks, currentBlock, exerciseState.repCount, resetDetector, saveWorkoutSession]);

  const handleSetCompleteRef = useRef(handleSetComplete);
  useEffect(() => { handleSetCompleteRef.current = handleSetComplete; }, [handleSetComplete]);

  const handleStop = () => {
    const setRecord = buildCurrentSetRecord();
    const allSets = [...completedSets, setRecord];
    setCompletedSets(allSets);
    setCompletedSetsReps(prev => prev + setRecord.reps);
    saveWorkoutSession(allSets);
    const totalReps = allSets.reduce((sum, s) => sum + s.reps, 0);
    if (totalReps === 0) {
      setScreen('idle');
    } else {
      setGoalReached(false); // Manual stop = no celebration
      const totalElapsed = Math.round((Date.now() - workoutStartTimeRef.current) / 1000);
      elapsedTimeRef.current = totalElapsed;
      setElapsedTime(totalElapsed);
      setScreen('stopped');
    }
  };

  const handleTimerEnd = () => {
    const totalElapsed = Math.round((Date.now() - workoutStartTimeRef.current) / 1000);
    elapsedTimeRef.current = totalElapsed;
    setElapsedTime(totalElapsed);
    handleSetCompleteRef.current();
  };

  // ── Rest between sets (same exercise) ───────────────────────────
  const handleRestComplete = () => {
    resetDetector();
    setCurrentSetIndex(prev => prev + 1);
    setStartTimeRef.current = Date.now();
    startCamera();
    setScreen('active');
  };

  // ── Rest between exercises (different blocks) ───────────────────
  const handleExerciseRestComplete = () => {
    resetDetector();
    const nextBlockIndex = currentBlockIndex + 1;
    const nextBlock = workoutPlan.blocks[nextBlockIndex];
    setCurrentBlockIndex(nextBlockIndex);
    setCurrentSetIndex(0);
    setStartTimeRef.current = Date.now();
    setSessionMode(nextBlock.sessionMode);
    setGoalReps(nextBlock.goalReps);
    setTimeGoal(nextBlock.timeGoal);
    onExerciseTypeChange(nextBlock.exerciseType);
    startCamera();
    setScreen('active');
  };

  // ── Skip entire current block ───────────────────────────────────
  const handleSkipBlock = () => {
    const remainingSets = totalSetsInBlock - currentSetIndex;
    const skippedSets: SetRecord[] = Array.from({ length: remainingSets }, () => ({
      reps: 0,
      averageScore: 0,
      repHistory: [],
      duration: 0,
      setMode: currentBlock.sessionMode,
      exerciseType: currentBlock.exerciseType,
    }));
    const newCompleted = [...completedSets, ...skippedSets];
    setCompletedSets(newCompleted);

    const isLastBlock = currentBlockIndex >= totalBlocks - 1;
    if (isLastBlock) {
      const totalReps = newCompleted.reduce((sum, s) => sum + s.reps, 0);
      if (totalReps === 0) {
        setScreen('idle');
      } else {
        saveWorkoutSession(newCompleted);
        const totalElapsed = Math.round((Date.now() - workoutStartTimeRef.current) / 1000);
        elapsedTimeRef.current = totalElapsed;
        setElapsedTime(totalElapsed);
        setScreen('stopped');
      }
    } else {
      resetDetector();
      setScreen('exercise-rest');
    }
  };

  const handleReset = () => {
    const effectiveLevel = savedLevelRef.current ?? liveLevel;
    if (effectiveLevel > levelBefore) {
      setScreen('levelup');
      return;
    }
    resetDetector();
    elapsedTimeRef.current = 0;
    setCurrentBlockIndex(0);
    setCurrentSetIndex(0);
    setCompletedSets([]);
    setCompletedSetsReps(0);
    savedLevelRef.current = null;
    setGoalReached(false);
    setScreen('idle');
  };

  const handleLevelUpContinue = () => {
    resetDetector();
    elapsedTimeRef.current = 0;
    setCurrentBlockIndex(0);
    setCurrentSetIndex(0);
    setCompletedSets([]);
    setCompletedSetsReps(0);
    savedLevelRef.current = null;
    setGoalReached(false);
    setScreen('idle');
  };

  // ── Side effects ────────────────────────────────────────────────

  // Level-up sound during active sessions
  useEffect(() => {
    if (screen === 'active' && liveLevel > prevLevelRef.current) {
      initAudio();
      if (soundEnabled) playLevelUpSound();
    }
    prevLevelRef.current = liveLevel;
  }, [liveLevel, screen, soundEnabled, playLevelUpSound, initAudio]);

  // Auto-complete set when rep goal reached
  useEffect(() => {
    if (screen === 'active' && currentBlock.sessionMode === 'reps' && exerciseState.repCount >= currentBlock.goalReps) {
      const totalElapsed = Math.round((Date.now() - workoutStartTimeRef.current) / 1000);
      elapsedTimeRef.current = totalElapsed;
      setElapsedTime(totalElapsed);
      handleSetCompleteRef.current();
    }
  }, [exerciseState.repCount, screen, currentBlock.sessionMode, currentBlock.goalReps]);

  // ── Return ──────────────────────────────────────────────────────
  return {
    // Screen
    screen,
    // Session config (active block's values)
    goalReps, setGoalReps,
    sessionMode, setSessionMode,
    timeGoal, setTimeGoal,
    soundEnabled, setSoundEnabled,
    // Workout plan
    workoutPlan, setWorkoutPlan,
    currentBlock,
    currentBlockIndex, currentSetIndex,
    completedSets, completedSetsReps,
    isMultiSet, isMultiExercise,
    totalSetsInBlock, totalBlocks, totalSetsAllBlocks,
    flatSetIndex,
    activeExerciseType,
    // Level & XP
    liveLevel, liveProgressPct, levelBefore,
    savedLevel: savedLevelRef.current,
    lastSessionXp,
    goalReached,
    // Timing
    elapsedTime, elapsedTimeRef,
    // Handlers
    handleStart, handleOpenConfig, handleWorkoutStart, handleBackToIdle,
    handleStop, handleTimerEnd,
    handleRestComplete, handleExerciseRestComplete,
    handleSkipBlock,
    handleReset, handleLevelUpContinue,
  };
}
