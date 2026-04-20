/**
 * workoutReducer.ts — Pure reducer for the workout state machine.
 *
 * Every screen transition is an explicit action. This makes the state machine
 * traceable, testable, and impossible to have implicit transitions.
 */
import type { SetRecord } from '@exercises/types';
import type { AppScreen } from './workoutTypes';

// ── State ────────────────────────────────────────────────────────

export interface WorkoutState {
  screen: AppScreen;
  currentBlockIndex: number;
  currentSetIndex: number;
  completedSets: SetRecord[];
  completedSetsReps: number;
  goalReached: boolean;
  elapsedTime: number;
  /** True while an async save is in flight — guards against double-start */
  isSaving: boolean;
}

export const INITIAL_WORKOUT_STATE: WorkoutState = {
  screen: 'idle',
  currentBlockIndex: 0,
  currentSetIndex: 0,
  completedSets: [],
  completedSetsReps: 0,
  goalReached: false,
  elapsedTime: 0,
  isSaving: false,
};

// ── Actions ──────────────────────────────────────────────────────

export type WorkoutAction =
  | { type: 'START_WORKOUT' }
  | { type: 'OPEN_CONFIG' }
  | { type: 'BACK_TO_IDLE' }
  | {
      type: 'SET_COMPLETE';
      setRecord: SetRecord;
      isLastSetInBlock: boolean;
      isLastBlock: boolean;
      goalReached: boolean;
      elapsedTime: number;
      totalReps: number;
    }
  | {
      type: 'MANUAL_STOP';
      setRecord: SetRecord;
      elapsedTime: number;
      totalReps: number;
    }
  | { type: 'REST_COMPLETE' }
  | { type: 'EXERCISE_REST_COMPLETE'; nextBlockIndex: number }
  | {
      type: 'SKIP_BLOCK';
      skippedSets: SetRecord[];
      isLastBlock: boolean;
      elapsedTime: number;
      totalReps: number;
    }
  | { type: 'TIMER_END'; elapsedTime: number }
  | { type: 'RESET_TO_IDLE' }
  | { type: 'SHOW_LEVEL_UP' }
  | { type: 'SAVE_STARTED' }
  | { type: 'SAVE_COMPLETED' }
  | { type: 'SAVE_FAILED' }
  | {
      type: 'RESUME_WORKOUT';
      completedSets: SetRecord[];
      blockIndex: number;
      setIndex: number;
      elapsedTime: number;
    }
  | {
      type: 'DISCARD_CHECKPOINT';
      completedSets: SetRecord[];
      elapsedTime: number;
    };

// ── Reducer ──────────────────────────────────────────────────────

export function workoutReducer(state: WorkoutState, action: WorkoutAction): WorkoutState {
  switch (action.type) {
    case 'START_WORKOUT':
      return { ...INITIAL_WORKOUT_STATE, screen: 'active' };

    case 'OPEN_CONFIG':
      return { ...state, screen: 'config' };

    case 'BACK_TO_IDLE':
      return { ...state, screen: 'idle' };

    case 'SET_COMPLETE': {
      const newSets = [...state.completedSets, action.setRecord];
      const newReps = state.completedSetsReps + action.setRecord.reps;

      if (action.isLastSetInBlock && action.isLastBlock) {
        if (action.totalReps === 0) {
          return { ...INITIAL_WORKOUT_STATE };
        }
        return {
          ...state,
          completedSets: newSets,
          completedSetsReps: newReps,
          goalReached: action.goalReached,
          elapsedTime: action.elapsedTime,
          screen: 'stopped',
        };
      }
      if (action.isLastSetInBlock) {
        return { ...state, completedSets: newSets, completedSetsReps: newReps, screen: 'exercise-rest' };
      }
      return { ...state, completedSets: newSets, completedSetsReps: newReps, screen: 'rest' };
    }

    case 'MANUAL_STOP': {
      const allSets = [...state.completedSets, action.setRecord];
      const allReps = state.completedSetsReps + action.setRecord.reps;
      if (action.totalReps === 0) {
        return { ...INITIAL_WORKOUT_STATE };
      }
      return {
        ...state,
        completedSets: allSets,
        completedSetsReps: allReps,
        goalReached: false,
        elapsedTime: action.elapsedTime,
        screen: 'stopped',
      };
    }

    case 'REST_COMPLETE':
      return { ...state, currentSetIndex: state.currentSetIndex + 1, screen: 'active' };

    case 'EXERCISE_REST_COMPLETE':
      return { ...state, currentBlockIndex: action.nextBlockIndex, currentSetIndex: 0, screen: 'active' };

    case 'SKIP_BLOCK': {
      const newSets = [...state.completedSets, ...action.skippedSets];
      if (action.isLastBlock) {
        const totalReps = newSets.reduce((sum, s) => sum + s.reps, 0);
        if (totalReps === 0) {
          return { ...INITIAL_WORKOUT_STATE };
        }
        return { ...state, completedSets: newSets, elapsedTime: action.elapsedTime, screen: 'stopped' };
      }
      return { ...state, completedSets: newSets, screen: 'exercise-rest' };
    }

    case 'TIMER_END':
      return { ...state, elapsedTime: action.elapsedTime };

    case 'RESET_TO_IDLE':
      return { ...INITIAL_WORKOUT_STATE };

    case 'SHOW_LEVEL_UP':
      return { ...state, screen: 'levelup' };

    case 'SAVE_STARTED':
      return { ...state, isSaving: true };

    case 'SAVE_COMPLETED':
      return { ...state, isSaving: false };

    case 'SAVE_FAILED':
      return { ...state, isSaving: false };

    case 'RESUME_WORKOUT':
      return {
        ...INITIAL_WORKOUT_STATE,
        screen: 'active',
        currentBlockIndex: action.blockIndex,
        currentSetIndex: action.setIndex,
        completedSets: action.completedSets,
        completedSetsReps: action.completedSets.reduce((sum, s) => sum + s.reps, 0),
        elapsedTime: action.elapsedTime,
      };

    case 'DISCARD_CHECKPOINT': {
      const totalReps = action.completedSets.reduce((sum, s) => sum + s.reps, 0);
      if (totalReps === 0) return INITIAL_WORKOUT_STATE;
      return {
        ...INITIAL_WORKOUT_STATE,
        screen: 'stopped',
        completedSets: action.completedSets,
        completedSetsReps: totalReps,
        goalReached: false,
        elapsedTime: action.elapsedTime,
      };
    }

    default:
      return state;
  }
}
