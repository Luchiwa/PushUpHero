/**
 * ExerciseStateContext — carries the MediaPipe-driven ExerciseState (reps,
 * score, phase, calibration, …) which updates ~30×/sec.
 *
 * Split from WorkoutContext so that slow-changing consumers (screens, modals,
 * handlers) don't re-render at frame rate.
 *
 * Provider lives in App.tsx. High-frequency consumers call `useExerciseState()`.
 */
import { createContext, useContext } from 'react';
import type { ExerciseState } from '@exercises/types';

export const ExerciseStateContext = createContext<ExerciseState | null>(null);

export function useExerciseState(): ExerciseState {
  const ctx = useContext(ExerciseStateContext);
  if (!ctx) throw new Error('useExerciseState must be used within ExerciseStateContext.Provider');
  return ctx;
}
