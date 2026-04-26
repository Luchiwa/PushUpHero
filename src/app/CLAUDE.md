# App — State Management & Orchestration

## Workout State Machine

All workout-feature files live in `src/app/workout/` (precedent for a `src/app/<feature>/` subfolder when an orchestrator pulls in many sub-hooks). The core game loop uses a **reducer + orchestrator + state-owning sub-hooks + pure helpers** pattern:

```
workout/
  workoutReducer.ts          Pure state transitions (no side effects)
  workoutTypes.ts            Shared types (AppScreen, SessionMode, durationToSeconds)
  useWorkoutPlan.ts          Plan config, derived values, set building, timing refs
  useWorkoutSession.ts       Slim orchestrator: save + quest eval + body profile
  useWorkoutSave.ts          Owns sessionSavedRef + the Firestore/guest save
  useQuestEvaluation.ts      Owns questCompletedThisSession + per-session eval
  xpProjection.ts            Pure helpers: computeFinalXp, derivePrimaryExercise
  bodyProfileCapture.ts      Pure helper: maybeCaptureBodyProfile
  useWorkoutMachineCore.ts   Reducer + plan + session + dispatch-only handlers
  useWorkoutExecution.ts     Side-effect handlers + effects + ref-synced setters
  useWorkoutStateMachine.ts  Top-level orchestrator (core + execution → public API)
WorkoutContext.tsx           Explicit WorkoutContextType interface, consumed via useWorkout()
```

Why this layout: the original 449-LOC `useWorkoutStateMachine` and 239-LOC `useWorkoutSession` mixed orchestration with multi-domain side effects, so any change to the save flow or reducer touched a giant file with stale-closure-prone callbacks. PUS-14 split them along the responsibility seams. See the **Hook decomposition rules** section in the root `CLAUDE.md` for the heuristics that triggered the split, the **non-stable deps** counting convention, and the prohibition on `ReturnType<typeof useFooHook>` context types.

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

**WorkoutContext** → `useWorkout()` exposes the explicit `WorkoutContextType` interface declared in `WorkoutContext.tsx`. The orchestrator returns `WorkoutMachineReturn` (= `Omit<WorkoutContextType, 'exerciseType' | 'changeExerciseType'>`); App.tsx merges the two App-owned fields in at the Provider boundary. Components never bypass `useWorkout()` for direct state access.

### Auth boundary

`AuthProvider` imports auth operations from `@services/authService` only — `subscribeAuthState`, `signInWithGoogle`, `logoutSession`. **No `firebase/*` import is allowed in `src/app/`.** The `User → AppUser` mapping happens at the service boundary, so the rest of the app sees only domain types.

## Important Patterns

- **Refs for stale closure prevention**: `goalRepsRef`, `sessionModeRef`, `timeGoalRef` are synced via wrapper setters that update the ref synchronously. `handleStart` reads from refs, not state.
- **useRefSync**: Custom hook that keeps a ref in sync with a value — avoids listing it as a dependency.
- **Save guard**: `sessionSavedRef` + `isSaving` flag prevent double-saves. `SAVE_STARTED` locks, `SAVE_COMPLETED`/`SAVE_FAILED` unlock.
- **Exercise type sync**: `changeExerciseType()` in WorkoutContext updates local state AND syncs the workout plan's first block.
