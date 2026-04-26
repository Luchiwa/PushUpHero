/**
 * useWorkoutPlan — Owns workout plan configuration, derived block/set values,
 * set record building, and timing refs.
 *
 * Receives currentBlockIndex / currentSetIndex from the reducer (no state duplication).
 */
import { useCallback, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { createDefaultBlock, type ExerciseState, type ExerciseType, type SetRecord, type TimeDuration, type WorkoutBlock, type WorkoutPlan } from '@exercises/types';
import type { SessionMode } from './workoutTypes';

// ── Props ────────────────────────────────────────────────────────

interface UseWorkoutPlanProps {
  exerciseState: ExerciseState;
  currentBlockIndex: number;
  currentSetIndex: number;
}

// ── Return type ──────────────────────────────────────────────────

export interface UseWorkoutPlanReturn {
  // Config state + setters
  goalReps: number;
  setGoalReps: Dispatch<SetStateAction<number>>;
  sessionMode: SessionMode;
  setSessionMode: Dispatch<SetStateAction<SessionMode>>;
  timeGoal: TimeDuration;
  setTimeGoal: Dispatch<SetStateAction<TimeDuration>>;
  soundEnabled: boolean;
  setSoundEnabled: Dispatch<SetStateAction<boolean>>;

  // Plan state + setter
  workoutPlan: WorkoutPlan;
  setWorkoutPlan: Dispatch<SetStateAction<WorkoutPlan>>;

  // Derived values
  currentBlock: WorkoutBlock;
  isMultiSet: boolean;
  isMultiExercise: boolean;
  totalSetsInBlock: number;
  totalBlocks: number;
  totalSetsAllBlocks: number;
  flatSetIndex: number;
  activeExerciseType: ExerciseType;

  // Set building
  buildCurrentSetRecord: () => SetRecord;

  // Timing refs
  workoutStartTimeRef: MutableRefObject<number>;

  // Helpers
  stampSetStartTime: () => void;
  resetTimingRefs: () => void;
  syncConfigFromBlock: (block: WorkoutBlock) => void;
}

// ── Hook ─────────────────────────────────────────────────────────

export function useWorkoutPlan({
  exerciseState,
  currentBlockIndex,
  currentSetIndex,
}: UseWorkoutPlanProps): UseWorkoutPlanReturn {
  // ── Config state ─────────────────────────────────────────────
  const [goalReps, setGoalReps] = useState(10);
  const [sessionMode, setSessionMode] = useState<SessionMode>('reps');
  const [timeGoal, setTimeGoal] = useState<TimeDuration>({ minutes: 0, seconds: 30 });
  const [soundEnabled, setSoundEnabled] = useState(true);

  // ── Plan state ───────────────────────────────────────────────
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan>({
    blocks: [createDefaultBlock('pushup')],
  });

  // ── Timing refs ──────────────────────────────────────────────
  const setStartTimeRef = useRef(0);
  const workoutStartTimeRef = useRef(0);

  // ── Derived values ───────────────────────────────────────────
  const currentBlock = workoutPlan.blocks[currentBlockIndex]
    ?? workoutPlan.blocks[0]
    ?? createDefaultBlock('pushup');

  const isMultiExercise = workoutPlan.blocks.length > 1;
  const isMultiSet = currentBlock.numberOfSets > 1;
  const totalSetsInBlock = currentBlock.numberOfSets;
  const totalBlocks = workoutPlan.blocks.length;
  const totalSetsAllBlocks = workoutPlan.blocks.reduce((sum, b) => sum + b.numberOfSets, 0);
  const flatSetIndex = workoutPlan.blocks
    .slice(0, currentBlockIndex)
    .reduce((sum, b) => sum + b.numberOfSets, 0) + currentSetIndex;
  const activeExerciseType = currentBlock.exerciseType;

  // ── Set building ─────────────────────────────────────────────
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
    if (currentBlock.sessionMode === 'time') record.timeGoal = durationToSecondsLocal(currentBlock.timeGoal);
    return record;
  }, [exerciseState, currentBlock]);

  // ── Helpers ──────────────────────────────────────────────────
  const stampSetStartTime = useCallback(() => {
    setStartTimeRef.current = Date.now();
  }, []);

  const resetTimingRefs = useCallback(() => {
    setStartTimeRef.current = Date.now();
    workoutStartTimeRef.current = Date.now();
  }, []);

  const syncConfigFromBlock = useCallback((block: WorkoutBlock) => {
    setSessionMode(block.sessionMode);
    setGoalReps(block.goalReps);
    setTimeGoal(block.timeGoal);
  }, []);

  return {
    goalReps, setGoalReps,
    sessionMode, setSessionMode,
    timeGoal, setTimeGoal,
    soundEnabled, setSoundEnabled,
    workoutPlan, setWorkoutPlan,
    currentBlock,
    isMultiSet, isMultiExercise,
    totalSetsInBlock, totalBlocks, totalSetsAllBlocks,
    flatSetIndex,
    activeExerciseType,
    buildCurrentSetRecord,
    workoutStartTimeRef,
    stampSetStartTime, resetTimingRefs, syncConfigFromBlock,
  };
}

/** Local helper to avoid circular import with workoutTypes */
function durationToSecondsLocal(d: TimeDuration): number {
  return d.minutes * 60 + d.seconds;
}
