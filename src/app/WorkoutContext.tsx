/**
 * WorkoutContext — Provides the full workout state machine + exercise info
 * to any screen/overlay, eliminating prop drilling through App.tsx.
 *
 * Provider lives in App.tsx.  Consumers call `useWorkout()`.
 */
import { createContext, useContext } from 'react';
import type { ExerciseType } from '@exercises/types';
import type { WorkoutMachineReturn } from './workout/useWorkoutStateMachine';

export interface WorkoutContextType extends WorkoutMachineReturn {
  exerciseType: ExerciseType;
  /** Combined setter: updates local exerciseType + syncs workoutPlan block 0 */
  changeExerciseType: (type: ExerciseType) => void;
}

export const WorkoutContext = createContext<WorkoutContextType | null>(null);

export function useWorkout(): WorkoutContextType {
  const ctx = useContext(WorkoutContext);
  if (!ctx) throw new Error('useWorkout must be used within WorkoutContext.Provider');
  return ctx;
}
