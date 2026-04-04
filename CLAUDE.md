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

`@app`, `@screens`, `@overlays`, `@modals`, `@components`, `@hooks`, `@data`, `@exercises`, `@domain`, `@services`, `@infra`, `@assets` all map to `src/<name>/`.

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

**Exercise registry** (`src/exercises/registry.ts`) is the single source of truth for all per-exercise config: detector factory, difficulty coefficient, key joints, position guide text, and coach phrases. Current exercises: pushup (×1.3 difficulty), squat (×1.0), pullup (×2.5). To add a new exercise: create the detector file, add an entry in the registry, add the type to `types.ts`, and add key joints to `poseOverlay.worker.ts` (Web Worker can't import the registry).

`src/exercises/types.ts` exports the `ExerciseType` literal union and shared domain types like `SessionRecord`.

### Camera & pose pipeline

`App.tsx` wires the pipeline: `useCamera()` -> `usePoseDetection()` (MediaPipe WASM) -> `useExerciseDetector()` -> workout state machine. The skeleton overlay renders on an OffscreenCanvas via a Web Worker (`src/workers/poseOverlay.worker.ts`) to avoid blocking the main thread.

### Lazy loading & code splitting

Screens and modals are lazy-loaded via `React.lazy()` + `<Suspense>`:

- **App.tsx** lazy-loads workout screens: `WorkoutConfigScreen`, `RestScreen`, `SummaryScreen`, `LevelUpScreen`
- **StartScreen** lazy-loads modals: `AuthModal`, `ProfileModal`, `QuickSessionModal`, `StatsScreen`, `QuestsScreen`

Modal state uses TypeScript discriminated unions for type safety: `type ActiveModal = null | { type: 'auth'; ... } | { type: 'profile'; ... } | ...`

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

All Firestore **write** operations are in `src/services/` (`userService.ts`, `friendService.ts`, `authService.ts`, `notificationService.ts`, `avatarService.ts`).

### Domain layer (`src/domain/`) — pure logic

Zero side effects, zero Firebase/browser API imports. Testable with just import + call + assert.

- `achievements.ts` — Static achievement definitions (`ACHIEVEMENTS` array, categories, tiers)
- `achievementEngine.ts` — Achievement evaluation logic (`evaluateAchievements`, `evaluateRecords`, `getAchievementProgress`)
- `xpSystem.ts` — XP calculations, level curves, tier logic. Difficulty coefficients derived from `EXERCISE_REGISTRY`. Exports `getTier(level): Tier` where `Tier = 'bronze' | 'silver' | 'gold' | 'platinum'`.
- `quests.ts` — Quest definitions + evaluation (`getQuestStatus`, `getActiveQuest`, `isQuestGoalMet`)
- `bodyProfile.ts` — Morphological calibration types and threshold functions
- `constants.ts` — Magic numbers, grade functions (`getGradeLetter`, `getGradeColor`). Grade colors are CSS custom properties (`--grade-s`, etc.) generated via SCSS `@each` loop. Grade backgrounds use CSS `color-mix()`.
- `authTypes.ts` — `AppUser`, `DbUser` interfaces

### Service layer (`src/services/`) — Firebase writes

Pure functions with no React dependency, all Firestore/Auth/Storage mutations:

- `authService.ts` — Firebase Auth operations, shared `translateAuthError()`. UI components never import `firebase/auth` directly.
- `userService.ts` — Profile writes, central `saveSession()` that atomically batches session + profile + feed + achievements.
- `friendService.ts` — Friend request lifecycle, `batchFetchProfileStats()`.
- `avatarService.ts` — Avatar upload/compression to Firebase Storage.
- `notificationService.ts` — FCM token registration, notification writes.
- `deleteAccount.ts` — Account deletion orchestration.
- `guestMerge.ts` / `guestStatsStore.ts` / `clearLocalStorage.ts` — Guest persistence and cleanup.

### Infrastructure (`src/infra/`) — platform plumbing

Browser APIs, Firebase init, Firestore refs. No business logic.

- `firebase.ts` — Firebase app initialization, exports `auth`, `db`, `storage` singletons.
- `refs.ts` — Centralized Firestore document/collection reference builders (`userRef(uid)`, `sessionsCol(uid)`, `friendRef(uid, friendId)`, etc.).
- `device.ts` — Platform detection (`isMobile()`, `isIos()`).
- `avatarCache.ts` — Avatar URL caching via Cache API.
- `soundEngine.ts` — Web Audio API sound effects.
- `speechEngine.ts` — Web Speech API wrapper.
- `coachEngine.ts` — Coaching phrase selection + speech dispatch.

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
- **Error boundaries**: Workout overlay and `StartScreen` are wrapped in `ErrorBoundary` with `SectionErrorFallback` — graceful degradation instead of white screen
- **Shared hooks**: `src/hooks/shared/useModalClose.ts` extracts the close-animation pattern used across modals/screens

## Skills (Claude Code)

Custom skills in `.claude/skills/`:

- **`/audit`** — Architecture audit with 10 parallel subagents. Supports focused audits (`/audit performance`) or full audit. Outputs severity-rated findings with file:line references and a prioritized action plan.
- **`/fix`** — Structured bug-fixing workflow: Phase 1 (diagnostic + user confirmation) → Phase 2 (implementation + per-file review agent) → Phase 3 (cross-file regression agent + build/lint) → Phase 4 (summary + test instructions + commit suggestion).
