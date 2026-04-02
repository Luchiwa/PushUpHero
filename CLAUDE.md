# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Vite dev server on :5173
npm run build            # tsc -b && vite build (output in dist/)
npm run lint             # ESLint (flat config, ESLint 9+)
npm run deploy           # build + firebase deploy --only hosting
npm run deploy:functions # cd functions && npm run build && firebase deploy --only functions
```

There is no test framework configured in this project.

## Architecture

**Push-Up Hero** is a PWA that uses your webcam + MediaPipe pose detection to count exercise reps, score form quality, and track progress with an XP/level system. It runs entirely client-side with Firebase for auth, storage, and cloud sync.

### Path aliases (configured in both vite.config.ts and tsconfig.app.json)

`@app`, `@screens`, `@overlays`, `@modals`, `@components`, `@hooks`, `@data`, `@exercises`, `@lib`, `@assets` all map to `src/<name>/`.

### State management: three-tier context providers

Auth state is split across three nested contexts in `src/app/AuthProvider.tsx`:

1. **AuthCoreContext** (outer) — Firebase auth state, login/logout methods
2. **LevelContext** (inner) — XP, level, per-exercise XP tracking
3. **SessionContext** (inner) — Session history, cloud sync state

Prefer the granular hooks (`useAuthCore()`, `useLevel()`, `useSessions()`) — there is no merged facade.

### Workout state machine

The core game loop lives in `src/app/useWorkoutStateMachine.ts`, composed of three sub-hooks:

- **workoutReducer** — Pure reducer with explicit screens: `'idle' | 'config' | 'active' | 'rest' | 'exercise-rest' | 'stopped' | 'levelup'`. No side effects.
- **useWorkoutPlan** — Multi-exercise workout configuration (blocks of exercises with sets, reps/time modes, rest periods)
- **useWorkoutSession** — Session persistence to Firestore, XP calculation, level-up detection

All workout state flows through **WorkoutContext** (`src/app/WorkoutContext.tsx`). Components consume `useWorkout()` — never bypass it for direct state access.

### Exercise detection system

All detectors extend `BaseExerciseDetector` (`src/exercises/BaseExerciseDetector.ts`):

- **Calibration phase** (~90 frames) captures body morphology and locks a bounding box
- **Bounding box lock** rejects poses from different people (anti-cheat for gym environments)
- **Body profile** stores captured ratios for adaptive thresholds across sessions
- Concrete detectors: `PushUpDetector`, `SquatDetector`, `PullUpDetector` — each implements `processPose(landmarks)` with exercise-specific phase detection and scoring

Exercise type is `'pushup' | 'squat' | 'pullup'` (defined in `src/exercises/types.ts`).

**Exercise registry** (`src/exercises/registry.ts`) centralizes all per-exercise config: detector factory, difficulty coefficient, key joints, position guide text, and coach phrases. To add a new exercise: create the detector file, add an entry in the registry, add the type to `types.ts`, and add key joints to `poseOverlay.worker.ts` (Web Worker can't import the registry).

### Camera & pose pipeline

`App.tsx` wires the pipeline: `useCamera()` -> `usePoseDetection()` (MediaPipe WASM) -> `useExerciseDetector()` -> workout state machine. The skeleton overlay renders on an OffscreenCanvas via a Web Worker (`src/workers/poseOverlay.worker.ts`) to avoid blocking the main thread.

### Styling

SCSS with design tokens in `src/styles/_variables.scss`. Tokens are exported as CSS custom properties on `:root`. Component styles are co-located (e.g., `MyComponent.tsx` + `MyComponent.scss`). The SCSS `loadPaths` includes `src/styles/` so partials can be imported by name (e.g., `@use 'variables'`).

Key conventions:
- Use explicit color names (`$green`, `$red`, `$accent`) not generic names
- Z-index uses the scale from `_variables.scss` (`$z-base` through `$z-maximum`) — no magic numbers
- No dark mode yet, but the token architecture supports it

### Data layer (Firestore reads)

All Firestore **read** operations (listeners and queries) are in `src/data/` repositories. Hooks import from `@data/` — they never import `firebase/firestore` directly. This keeps hooks testable and backend-agnostic.

- `userRepository.ts` — User profile listeners (`onUserProfile`, `onUserDoc`)
- `sessionRepository.ts` — Session listeners and queries (`onRecentSessions`, `getSessionsByDateRange`, `getOldestSessionDate`)
- `friendRepository.ts` — Friend list and request listeners (`onFriendsList`, `onIncomingRequests`, `onOutgoingRequests`)
- `activityRepository.ts` — Activity feed queries (`getRecentActivity`)
- `notificationRepository.ts` — Notification listener (`onUnreadNotifications`)

All Firestore **write** operations are in `src/lib/` services (`userService.ts`, `friendService.ts`, `authService.ts`, `notificationService.ts`, `avatarService.ts`).

### Firestore refs

All Firestore document/collection references are centralized in `src/lib/refs.ts`. Use helpers like `userRef(uid)`, `sessionsCol(uid)`, `friendRef(uid, friendId)` instead of inline `doc(db, ...)` calls.

### Constants

All magic numbers live in `src/lib/constants.ts` — grade thresholds, calibration frames, set/rep limits, cooldowns, etc. Grade colors are CSS custom properties (`--grade-s`, `--grade-a`, etc.) defined in `_variables.scss` — JS reads them via `var()` references from `getGradeColor()`.

### Cloud Functions

In `functions/src/index.ts`, deployed to `europe-west1`:
- **sendPushNotification** — Firestore trigger on notification document creation
- **resetExpiredStreaks** — Scheduled 03:00 UTC (Europe/Paris)
- **sendStreakReminders** — Scheduled 18:00 UTC (Europe/Paris)

### PWA / Service Worker

`src/sw.ts` uses Workbox (via vite-plugin-pwa with `injectManifest` strategy). Handles precaching, push notification display, and notification click routing.

## Key patterns

- **Refs for latest values in callbacks**: Use `useRef` + sync `useEffect` to avoid stale closures (common pattern throughout hooks)
- **Guard clauses in reducers**: Early-return if the action doesn't apply to the current screen state
- **Locale for dates**: Uses `sv-SE` locale with `Europe/Paris` timezone to get YYYY-MM-DD format consistently
- **Detector lifecycle**: Call `resetDetector()` before reusing on a new exercise type; inject body profile via `setBodyProfile()` after construction
- **Landmark validation**: Always check `areLandmarksVisible()` before using MediaPipe landmarks — the model hallucinates positions for occluded joints
