# App — State Management & Orchestration

## Workout State Machine

The core game loop uses a **reducer + hook composition** pattern:

```
workoutReducer.ts      Pure state transitions (no side effects)
useWorkoutPlan.ts      Plan config, derived values, set building, timing refs
useWorkoutSession.ts   Session save, XP calc, quest progress, body profile
useWorkoutStateMachine.ts   Orchestrator composing the above three
WorkoutContext.tsx      React context provider — consumed via useWorkout()
```

### Screen States

```
idle → config → active ↔ rest → active → ... → stopped → levelup? → idle
                  ↓                              ↑
              exercise-rest ─────────────────────┘
```

- `idle` — StartScreen
- `config` — WorkoutConfigScreen (multi-exercise builder)
- `active` — Exercising (camera + pose detection running)
- `rest` — Between sets (same exercise block)
- `exercise-rest` — Between exercise blocks
- `stopped` — SummaryScreen (session saved)
- `levelup` — LevelUpScreen (only if level increased)

### Key State Shape

```typescript
WorkoutState {
  screen, currentBlockIndex, currentSetIndex,
  completedSets: SetRecord[],
  completedSetsReps, goalReached, elapsedTime, isSaving
}
```

- `currentBlockIndex` / `currentSetIndex` are updated in REST_COMPLETE and EXERCISE_REST_COMPLETE, NOT in SET_COMPLETE
- `completedSets` grows on SET_COMPLETE (set appended before screen transition)
- `isSaving` guards against double-start during async Firestore save

### Timing Refs

- `workoutStartTimeRef` — stamped at workout start, used for elapsed time: `Date.now() - ref.current`
- `setStartTimeRef` — stamped before each set, used for per-set duration

On resume from checkpoint, `workoutStartTimeRef` is backdated: `Date.now() - savedElapsedMs` so all existing elapsed time calculations remain correct.

### Checkpoint Persistence

After each completed set (except the final one), a checkpoint is saved to localStorage containing `{ plan, completedSets, elapsedMs, savedAt }`. This enables the "Resume Workout" feature on the StartScreen. Checkpoint is cleared on workout completion, manual stop, or when starting a new workout.

## Context Architecture

Three nested contexts in `AuthProvider.tsx` prevent unrelated re-renders:

1. **AuthCoreContext** → `useAuthCore()` — Firebase auth, user/dbUser, login/logout
2. **LevelContext** → `useLevel()` — XP, level, per-exercise XP
3. **SessionContext** → `useSessions()` — Session list, count

**WorkoutContext** → `useWorkout()` wraps the entire state machine return. Components never bypass it for direct state access.

### Auth boundary

`AuthProvider` imports auth operations from `@services/authService` only — `subscribeAuthState`, `signInWithGoogle`, `logoutSession`. **No `firebase/*` import is allowed in `src/app/`.** The `User → AppUser` mapping happens at the service boundary, so the rest of the app sees only domain types.

## Important Patterns

- **Refs for stale closure prevention**: `goalRepsRef`, `sessionModeRef`, `timeGoalRef` are synced via wrapper setters that update the ref synchronously. `handleStart` reads from refs, not state.
- **useRefSync**: Custom hook that keeps a ref in sync with a value — avoids listing it as a dependency.
- **Save guard**: `sessionSavedRef` + `isSaving` flag prevent double-saves. `SAVE_STARTED` locks, `SAVE_COMPLETED`/`SAVE_FAILED` unlock.
- **Exercise type sync**: `changeExerciseType()` in WorkoutContext updates local state AND syncs the workout plan's first block.
