/**
 * workoutTypes.ts — Shared types and utilities for the workout state machine.
 * Extracted so sub-hooks, screens, and modals can import without pulling in the full hook.
 */
import type { TimeDuration } from '@exercises/types';

export type AppScreen = 'idle' | 'config' | 'active' | 'rest' | 'exercise-rest' | 'stopped' | 'levelup';
export type SessionMode = 'reps' | 'time';

export function durationToSeconds(d: TimeDuration): number {
  return d.minutes * 60 + d.seconds;
}
