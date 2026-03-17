/**
 * useWorkoutStateMachine — Encapsulates the entire workout state machine:
 * screen transitions, multi-set logic, session saving, level tracking.
 *
 * App.tsx only needs to wire camera/pose and render the JSX.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useSessionHistory } from '@hooks/useSessionHistory';
import { useAuth } from '@hooks/useAuth';
import { useSoundEffect } from '@hooks/useSoundEffect';
import { calculateLevelFromTotalReps, calculateTotalRepsForLevel } from '@hooks/useLevelSystem';
import type { ExerciseState } from '@exercises/types';
import type { SetRecord } from '@exercises/types';
import type { WorkoutConfig } from '@screens/WorkoutConfigScreen/WorkoutConfigScreen';

// ── Public types ────────────────────────────────────────────────
export type AppScreen = 'idle' | 'config' | 'active' | 'rest' | 'victory' | 'stopped' | 'levelup';
export type SessionMode = 'reps' | 'time';

interface UseWorkoutStateMachineProps {
  exerciseState: ExerciseState;
  resetDetector: () => void;
  startCamera: (mode?: 'user' | 'environment') => void;
}

export function useWorkoutStateMachine({
  exerciseState,
  resetDetector,
  startCamera,
}: UseWorkoutStateMachineProps) {
  // ── Core state ──────────────────────────────────────────────────
  const [screen, setScreen] = useState<AppScreen>('idle');
  const [goalReps, setGoalReps] = useState(10);
  const [sessionMode, setSessionMode] = useState<SessionMode>('reps');
  const [timeGoal, setTimeGoal] = useState({ minutes: 0, seconds: 30 });
  const [soundEnabled, setSoundEnabled] = useState(true);

  const { addSession } = useSessionHistory();
  const { initAudio, playLevelUpSound } = useSoundEffect();
  const { totalLifetimeReps } = useAuth();

  // ── Level tracking ──────────────────────────────────────────────
  const prevLevelRef = useRef(0);
  const [levelBefore, setLevelBefore] = useState(0);
  const elapsedTimeRef = useRef(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const sessionSavedRef = useRef(false);

  // ── Multi-set state ─────────────────────────────────────────────
  const [workoutConfig, setWorkoutConfig] = useState<WorkoutConfig>({
    numberOfSets: 3,
    sessionMode: 'reps',
    goalReps: 10,
    timeGoal: { minutes: 0, seconds: 30 },
    restTime: { minutes: 1, seconds: 0 },
  });
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [completedSets, setCompletedSets] = useState<SetRecord[]>([]);
  const [completedSetsReps, setCompletedSetsReps] = useState(0);
  const setStartTimeRef = useRef(0);
  const workoutStartTimeRef = useRef(0);

  const isMultiSet = workoutConfig.numberOfSets > 1
    && (screen === 'active' || screen === 'rest' || screen === 'victory' || screen === 'stopped' || screen === 'levelup');
  const totalSets = isMultiSet ? workoutConfig.numberOfSets : 1;

  // ── Live level projection ───────────────────────────────────────
  const currentSetReps = screen === 'active' ? exerciseState.repCount : 0;
  const allSessionReps = completedSetsReps + currentSetReps;
  const liveTotal = totalLifetimeReps + allSessionReps;
  const liveLevel = calculateLevelFromTotalReps(liveTotal);
  const liveLevelBase = calculateTotalRepsForLevel(liveLevel);
  const liveLevelNext = calculateTotalRepsForLevel(liveLevel + 1);
  const liveProgressPct = ((liveTotal - liveLevelBase) / (liveLevelNext - liveLevelBase)) * 100;

  // ── Build a SetRecord from the current exerciseState ────────────
  const buildCurrentSetRecord = useCallback((): SetRecord => {
    const setDuration = Math.round((Date.now() - setStartTimeRef.current) / 1000);
    const record: SetRecord = {
      reps: exerciseState.repCount,
      averageScore: Math.round(exerciseState.averageScore),
      repHistory: [...exerciseState.repHistory],
      duration: setDuration,
      setMode: sessionMode,
    };
    if (sessionMode === 'reps') record.goalReps = goalReps;
    if (sessionMode === 'time') record.timeGoal = timeGoal.minutes * 60 + timeGoal.seconds;
    return record;
  }, [exerciseState, sessionMode, goalReps, timeGoal]);

  // ── Save the entire workout as one session ──────────────────────
  const saveWorkoutSession = useCallback((allSets: SetRecord[]) => {
    if (sessionSavedRef.current) return;
    const totalReps = allSets.reduce((sum, s) => sum + s.reps, 0);
    if (totalReps === 0) return;

    sessionSavedRef.current = true;
    const weightedScoreSum = allSets.reduce((sum, s) => sum + s.averageScore * s.reps, 0);
    const avgScore = totalReps > 0 ? Math.round(weightedScoreSum / totalReps) : 0;
    const totalWorkoutDuration = Math.round((Date.now() - workoutStartTimeRef.current) / 1000);
    const restSeconds = workoutConfig.restTime.minutes * 60 + workoutConfig.restTime.seconds;
    const isMultiSetSession = allSets.length > 1;

    addSession({
      reps: totalReps,
      averageScore: avgScore,
      goalReps: isMultiSetSession ? goalReps * allSets.length : goalReps,
      sessionMode,
      elapsedTime: sessionMode === 'time' ? elapsedTimeRef.current : undefined,
      numberOfSets: isMultiSetSession ? allSets.length : undefined,
      restDuration: isMultiSetSession ? restSeconds : undefined,
      sets: isMultiSetSession ? allSets : undefined,
      totalDuration: isMultiSetSession ? totalWorkoutDuration : undefined,
    }).catch(err => {
      console.error('Failed to save session:', err);
      sessionSavedRef.current = false;
    });
  }, [addSession, goalReps, sessionMode, workoutConfig.restTime]);

  // ── Handlers ────────────────────────────────────────────────────

  const handleStart = () => {
    elapsedTimeRef.current = 0;
    sessionSavedRef.current = false;
    setLevelBefore(liveLevel);
    setCurrentSetIndex(0);
    setCompletedSets([]);
    setCompletedSetsReps(0);
    setStartTimeRef.current = Date.now();
    workoutStartTimeRef.current = Date.now();
    setWorkoutConfig(prev => ({ ...prev, numberOfSets: 1, sessionMode, goalReps, timeGoal }));
    startCamera();
    setScreen('active');
  };

  const handleOpenConfig = () => {
    setWorkoutConfig(prev => ({ ...prev, sessionMode, goalReps, timeGoal }));
    setScreen('config');
  };

  const handleWorkoutStart = () => {
    elapsedTimeRef.current = 0;
    sessionSavedRef.current = false;
    setLevelBefore(liveLevel);
    setCurrentSetIndex(0);
    setCompletedSets([]);
    setCompletedSetsReps(0);
    setStartTimeRef.current = Date.now();
    workoutStartTimeRef.current = Date.now();
    setSessionMode(workoutConfig.sessionMode);
    setGoalReps(workoutConfig.goalReps);
    setTimeGoal(workoutConfig.timeGoal);
    startCamera();
    setScreen('active');
  };

  const handleBackToIdle = () => {
    setScreen('idle');
  };

  const handleSetComplete = useCallback(() => {
    const setRecord = buildCurrentSetRecord();
    const newCompletedSets = [...completedSets, setRecord];
    setCompletedSets(newCompletedSets);
    setCompletedSetsReps(prev => prev + setRecord.reps);

    const isLastSet = currentSetIndex >= totalSets - 1;

    if (isLastSet) {
      setElapsedTime(elapsedTimeRef.current);
      const totalReps = newCompletedSets.reduce((sum, s) => sum + s.reps, 0);

      if (totalReps === 0) {
        // No reps at all → go straight back to start screen
        setScreen('idle');
      } else if (sessionMode === 'reps' && exerciseState.repCount >= goalReps) {
        setScreen('victory');
      } else if (sessionMode === 'time') {
        setScreen('victory');
      } else {
        saveWorkoutSession(newCompletedSets);
        setScreen('stopped');
      }
    } else {
      resetDetector();
      setScreen('rest');
    }
  }, [buildCurrentSetRecord, completedSets, currentSetIndex, totalSets, sessionMode, goalReps, exerciseState.repCount, resetDetector, saveWorkoutSession]);

  const handleSetCompleteRef = useRef(handleSetComplete);
  useEffect(() => { handleSetCompleteRef.current = handleSetComplete; }, [handleSetComplete]);

  const handleStop = () => {
    if (isMultiSet && currentSetIndex < totalSets - 1) {
      const setRecord = buildCurrentSetRecord();
      const allSets = [...completedSets, setRecord];
      setCompletedSets(allSets);
      setCompletedSetsReps(prev => prev + setRecord.reps);
      saveWorkoutSession(allSets);
      const totalReps = allSets.reduce((sum, s) => sum + s.reps, 0);
      if (totalReps === 0) {
        setScreen('idle');
      } else {
        setElapsedTime(elapsedTimeRef.current);
        setScreen('stopped');
      }
    } else {
      handleSetComplete();
    }
  };

  const handleTimerEnd = () => {
    setElapsedTime(elapsedTimeRef.current);
    handleSetCompleteRef.current();
  };

  const handleVictoryComplete = () => {
    saveWorkoutSession(completedSets);
    setElapsedTime(elapsedTimeRef.current);
    setScreen('stopped');
  };

  const handleRestComplete = () => {
    resetDetector();
    setCurrentSetIndex(prev => prev + 1);
    setStartTimeRef.current = Date.now();
    elapsedTimeRef.current = 0;
    startCamera();
    setScreen('active');
  };

  const handleReset = () => {
    if (liveLevel > levelBefore) {
      setScreen('levelup');
      return;
    }
    resetDetector();
    elapsedTimeRef.current = 0;
    setCurrentSetIndex(0);
    setCompletedSets([]);
    setCompletedSetsReps(0);
    setScreen('idle');
  };

  const handleLevelUpContinue = () => {
    resetDetector();
    elapsedTimeRef.current = 0;
    setCurrentSetIndex(0);
    setCompletedSets([]);
    setCompletedSetsReps(0);
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
    if (screen === 'active' && sessionMode === 'reps' && exerciseState.repCount >= goalReps) {
      setElapsedTime(elapsedTimeRef.current);
      handleSetCompleteRef.current();
    }
  }, [exerciseState.repCount, screen, sessionMode, goalReps]);

  // ── Return ──────────────────────────────────────────────────────
  return {
    // Screen
    screen,
    // Session config
    goalReps, setGoalReps,
    sessionMode, setSessionMode,
    timeGoal, setTimeGoal,
    soundEnabled, setSoundEnabled,
    // Multi-set
    workoutConfig, setWorkoutConfig,
    currentSetIndex, completedSets, completedSetsReps,
    isMultiSet, totalSets,
    // Level
    liveLevel, liveProgressPct, levelBefore,
    // Timing
    elapsedTime, elapsedTimeRef,
    // Handlers
    handleStart, handleOpenConfig, handleWorkoutStart, handleBackToIdle,
    handleStop, handleTimerEnd, handleVictoryComplete,
    handleRestComplete, handleReset, handleLevelUpContinue,
  };
}
