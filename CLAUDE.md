# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Vite dev server on :5173
npm run build            # tsc -b && vite build (output in dist/)
npm run lint             # ESLint (flat config, ESLint 9+)
npm run typecheck        # tsc --noEmit -p tsconfig.app.json (same command CI runs)
npm run deploy           # build + firebase deploy --only hosting
npm run deploy:functions # cd functions && npm run build && firebase deploy --only functions
```

There is no test framework configured in this project.

Node is pinned to **20** via `.nvmrc` + root `engines.node`. `functions/` declares the same version independently.

## Git workflow

See `CONTRIBUTING.md`. Tickets live in Linear (team `PUS`, workspace `pushuphero.linear.app`). One branch per ticket, using Linear's "Copy git branch name" (format `feature/<issueIdentifier>-<issueSlug>`, e.g. `feature/pus-9-resume-interrupted-workout-via-localstorage-checkpoint`). PR title: `[PUS-N] …`. PR body includes `Resolves [PUS-N](linear-url)` so the Linear integration can auto-close the ticket on merge. Conventional commits (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`); don't tag `PUS-N` in commit messages — the PR handles it.

## CI

Two workflows in `.github/workflows/`:

- **`ci.yml`** — runs on PR to `main`. Jobs: `frontend` (lint/typecheck/build + uploads `dist/` artifact), `functions` (conditional on `functions/**` changes via `dorny/paths-filter`), and `preview` (reuses the artifact and publishes a Firebase Hosting preview channel `pr-<number>` with a bot-comment URL that updates in place; 7-day auto-expiry).
- **`deploy.yml`** — runs on push to `main` (also `workflow_dispatch` with a `force` input). Uses `dorny/paths-filter@v3` to scope `firebase deploy --only …` to whichever targets actually changed (hosting / functions / firestore:rules / storage:rules). Docs-only pushes skip the deploy entirely. Frontend build and functions build are each gated on their target being in the deploy list. `force: true` bypasses the filter and redeploys everything.

Required GitHub settings: secret `FIREBASE_SERVICE_ACCOUNT` (service-account JSON) and variable `FIREBASE_PROJECT_ID`. See `README.md` → *Continuous Integration* for setup and rotation steps.

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

The core game loop lives in `src/app/workout/`, composed of a thin orchestrator + state-owning sub-hooks + pure helpers. PUS-14 broke the original 449-LOC `useWorkoutStateMachine` and 239-LOC `useWorkoutSession` into this layout:

- **workoutReducer** — Pure reducer with explicit screens (`'idle' | 'config' | 'active' | 'rest' | 'exercise-rest' | 'stopped' | 'levelup'`). No side effects.
- **useWorkoutPlan** — Plan configuration (blocks, sets, reps/time modes, rest periods), derived values, set building, timing refs.
- **useWorkoutMachineCore** — Mounts the reducer + plan + session, exposes the aggregate state and the trivial dispatch-only handlers.
- **useWorkoutExecution** — All side-effect-driven handlers (start/stop/skip/resume/…), the level-up sound effect, the auto-complete-on-rep-goal effect, and the ref-synced config setters.
- **useWorkoutSession** — Slim orchestrator over `useWorkoutSave` + `useQuestEvaluation` + the pure helpers (`xpProjection.ts`, `bodyProfileCapture.ts`).
- **useWorkoutStateMachine** — Top-level orchestrator composing core + execution. Returns `WorkoutMachineReturn` (declared in `WorkoutContext.tsx`).

All workout state flows through **WorkoutContext** (`src/app/WorkoutContext.tsx`). `WorkoutContextType` is an **explicit interface** (not `ReturnType<typeof …>`) so internal hook refactors stay invisible to consumers. Components consume `useWorkout()` — never bypass it for direct state access.

### Exercise detection system

Detector class hierarchy lives in `src/exercises/`:

- **`BaseExerciseDetector`** (`src/exercises/BaseExerciseDetector.ts`) — owns calibration lifecycle, bbox lock, dynamic calibration, scoring helpers, and the `runFinalizeCalibration` template method. Subclasses implement two abstracts: `getCalibrationFrames()` and `captureCalibrationRatios(med)`. Detectors with custom phase machines (`PullUpDetector`, `LegRaiseDetector`) `extends BaseExerciseDetector` directly.
- **`AngleBasedExerciseDetector`** (`src/exercises/base/AngleBasedExerciseDetector.ts`) — extends `BaseExerciseDetector` and adds `processAngleBasedPhase`, the standard "REST-counted" state machine. Detectors that count at the return-to-rest (`PushUpDetector`, `SquatDetector`) `extends AngleBasedExerciseDetector`.

Lifecycle:

- **Calibration phase** (~90 frames) captures body morphology and locks a bounding box
- **Bounding box lock** rejects poses from different people (anti-cheat for gym environments)
- **Body profile** stores captured ratios for adaptive thresholds across sessions
- Concrete detectors: `PushUpDetector`, `SquatDetector`, `PullUpDetector`, `LegRaiseDetector` — each implements `processPose(landmarks)` with exercise-specific phase detection and scoring

Exercise type is `'pushup' | 'squat' | 'pullup' | 'legraise'` (defined in `src/exercises/types.ts`). See `src/exercises/CLAUDE.md` for the full per-exercise spec, the "Adding a new exercise" checklist, and which base class to choose.

**Exercise registry** (`src/exercises/registry.ts`) is the single source of truth for all per-exercise config: detector factory, difficulty coefficient, key joints, position guide text, and coach phrases. Current exercises: pushup (×1.3 difficulty), squat (×1.0), pullup (×2.5). To add a new exercise: create the detector file, add an entry in the registry, add the type to `types.ts`, and add key joints to `poseOverlay.worker.ts` (Web Worker can't import the registry).

`src/exercises/types.ts` exports the `ExerciseType` literal union and shared domain types like `SessionRecord`.

### Camera & pose pipeline

`App.tsx` wires the pipeline: `useCamera()` -> `usePoseDetection()` (MediaPipe WASM) -> `useExerciseDetector()` -> workout state machine. The skeleton overlay renders on an OffscreenCanvas via a Web Worker (`src/workers/poseOverlay.worker.ts`) to avoid blocking the main thread.

### Lazy loading & code splitting

Screens and modals are lazy-loaded via `React.lazy()` + `<Suspense>`:

- **App.tsx** lazy-loads workout screens: `WorkoutConfigScreen`, `RestScreen`, `SummaryScreen`, `LevelUpScreen`
- **StartScreen** lazy-loads modals: `AuthModal`, `ProfileModal`, `QuickSessionModal`, `StatsScreen`, `QuestsScreen`

Modal state uses TypeScript discriminated unions for type safety: `type ActiveModal = null | { type: 'auth'; ... } | { type: 'profile'; ... } | ...`

### Styling — Arena dark-mode design system

SCSS design tokens live in `src/styles/tokens/` (color, typography, spacing, radius, shadow, motion, layout, gradient). Mixins in `src/styles/mixins/` (surface, glow, text, motion, hex, a11y). Import via `@use 'tokens' as *; @use 'mixins' as *;`. Component styles are co-located (`MyComponent.tsx` + `MyComponent.scss`).

**See `src/styles/CLAUDE.md` for the full Arena spec** — color semantics (ember=primary, gold=rewards, good=completion), typography mixins, card patterns, animations, and gotchas.

Key conventions:
- Arena IS the theme — the whole app is dark-mode obsidian + ember. No light-mode fork.
- Screen titles MUST use `@include title-screen` (ember, Oswald UPPERCASE, letter-spacing 2px).
- Gold only for rewards (XP, levels, achievements, ranks). `good` only for completion. `blood`/`ice` strictly semantic (grades/errors).
- Use `color-mix(in srgb, $color X%, transparent)` for tinted surfaces. Never deprecated `lighten()`/`darken()`.
- Cards inside `.page-body` (flex-column) need `flex-shrink: 0` or they compress on short viewports.
- `overflow: hidden` on a card clips ember `text-shadow` glows — `::before { inset: 0 }` is already self-clamped, parent doesn't need it.
- Z-index uses the scale in `tokens/_layout.scss` — no magic numbers.

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
- `authTypes.ts` — `AppUser`, `DbUser` interfaces. `DbUser` is the **domain** shape with nested sections (`profile`, `stats`, `progression`, plus top-level `achievements`/`records`/`bodyProfile`/`questProgress`). The Firestore wire format is the flat `FlatUserDoc` (in `@infra/firestoreValidators`); the repo unfolds flat → nested at the read boundary.

### Service layer (`src/services/`) — Firebase writes

Pure functions with no React dependency, all Firestore/Auth/Storage mutations:

- `authService.ts` — Firebase Auth operations, shared `translateAuthError()`. UI components never import `firebase/auth` directly.
- `userService.ts` — Profile writes, central `saveSession()` that atomically batches session + profile + feed + achievements.
- `friendService.ts` — Friend request lifecycle, `batchFetchProfileStats()`.
- `avatarService.ts` — Avatar upload/compression to Firebase Storage.
- `notificationService.ts` — FCM token registration, notification writes.
- `deleteAccount.ts` — Account deletion orchestration.
- `guestMerge.ts` / `guestStatsStore.ts` — Guest persistence and merge-on-login (storage handled by `@infra/storage`).
- `workoutCheckpointStore.ts` — Interrupted workout checkpoint persistence (via `@infra/storage`).

### Infrastructure (`src/infra/`) — platform plumbing

Browser APIs, Firebase init, Firestore refs. No business logic.

- `firebase.ts` — Firebase app initialization, exports `auth`, `db`, `storage` singletons.
- `refs.ts` — Centralized Firestore document/collection reference builders (`userRef(uid)`, `sessionsCol(uid)`, `friendRef(uid, friendId)`, etc.).
- `firestoreValidators.ts` — Type guards (`isFlatUserDoc`, `isSessionRecord`, …) and parsers (`parseNotification`, `parseActivityFeedDoc`, `tsToMs`) used by repositories before casting raw Firestore data. Also defines `FlatUserDoc` — the persistence shape for user docs (Firestore stays flat; the domain `DbUser` is a nested view over it, unfolded by `userRepository`).
- `storage.ts` — Typed `localStorage` access (`read`/`write`/`remove`/`clearAll`/`clearAppKeys`) plus the `STORAGE_KEYS` registry and `STORAGE_KEY_BUILDERS` for parameterized keys. Sole authorized importer of `window.localStorage`.
- `device.ts` — Platform detection (`isMobile()`, `isIos()`).
- `avatarCache.ts` — Avatar URL caching via Cache API.
- `soundEngine.ts` — Web Audio API sound effects.
- `speechEngine.ts` — Web Speech API wrapper.
- `coachEngine.ts` — Coaching phrase selection + speech dispatch.

### Firebase isolation rules (enforced by ESLint + reviewers)

These rules are non-negotiable. They were violated repeatedly before PUS-12 and earned the codebase a 5/10 score on the Firebase boundary.

- **Imports from `firebase/*` are allowed only in `src/infra/`, `src/services/`, and `src/data/`.** Any other layer (`src/app/`, `src/hooks/`, `src/screens/`, `src/components/`, `src/modals/`, `src/overlays/`) must go through a service or repo. ESLint blocks violations at lint time.
- **Repositories must never expose Firestore SDK types in public signatures.** No `DocumentData`, `Timestamp`, `DocumentChange`, `QuerySnapshot`, `DocumentSnapshot`, `DocumentReference` in exported function params or return types. Map to a domain shape and use `tsToMs` to coerce timestamps before they leave the repo.
- **Cast only after a guard.** Every `as FlatUserDoc` / `as SessionRecord` / `as FriendRequest` in `src/data/` must be preceded by the matching `isXxx(...)` guard from `firestoreValidators`. A doc that fails validation is filtered with `console.warn` — never propagated to the UI. The validated flat doc is then unfolded into the domain shape (e.g. `unfoldDbUser` in `userRepository`) before leaving the repo — UI never sees the persistence shape.
- **`onSnapshot` callbacks are synchronous.** No `getDoc`/`getDocs` inside the callback. If a join is needed, denormalize at write time, or batch via `where(documentId(), 'in', chunk)` outside the callback (chunks of 30, the Firestore hard limit).

### Storage isolation rules (enforced by ESLint + reviewers)

Mirror of the Firebase rules above, applied to `window.localStorage`. PUS-13 collapsed 17 keys spread across 11 files into a single registry; these invariants keep it that way.

- **Direct `localStorage` access is allowed only in `src/infra/storage.ts`.** Every other layer — including services and data — must go through the `read` / `write` / `remove` / `clearAppKeys` / `clearAll` API. ESLint blocks violations at lint time via `no-restricted-globals`.
- **All keys live in the `STORAGE_KEYS` registry** (or `STORAGE_KEY_BUILDERS` for parameterized keys like `feed_last_seen_${uid}`). Inline string literals are forbidden — they break "find references" and let renames silently rot.
- **Prefix scans for dynamic keys** (e.g. `feed_last_seen_*`, `pushup_encourage_*`) are owned by `clearAppKeys`. New parameterized key families must register their prefix in `DYNAMIC_KEY_PREFIXES` so logout cleanup stays exhaustive.
- **No module-level mutable cache for user-scoped data.** A cache that survives across users is a leak. Either lift to a Context invalidated on auth change (see `FeedCacheContext`), or accept refetch on remount.

### Hook decomposition rules (enforced by reviewers)

A "god hook" is a hook that grew across multiple unrelated responsibilities until any change risks breaking something far away. PUS-14 carved up two of them; these invariants keep new ones from accruing.

- **A hook callback must touch at most 2 domains.** If it mixes XP calc + Firestore save + quest eval + body-profile capture (the original `useWorkoutSession.saveWorkoutSession`), each domain extracts into its own state-owning sub-hook (`useWorkoutSave`, `useQuestEvaluation`) or pure helper (`xpProjection.ts`, `bodyProfileCapture.ts`). Multi-domain mixing is the disease; the rest are symptoms.
- **Heuristic signals — any one is a flag to look harder, not an automatic split:**
  - LOC > 200 in a single hook file
  - Returned shape > 12 properties
  - `useCallback` / `useMemo` with > 8 **non-stable** deps (`dispatch` from `useReducer` and refs are stable per React's contract — they don't count)
  - 3+ `useRefSync` to fight stale closures in the same hook
- **Context types are explicit interfaces.** Declare `WorkoutContextType`-style shapes field-by-field in the `*Context.tsx` file. Forbidden:
  ```ts
  // ❌ leaks the hook's internal shape into the public contract
  export type WorkoutMachineReturn = ReturnType<typeof useWorkoutStateMachine>;
  export interface WorkoutContextType extends WorkoutMachineReturn { … }
  ```
  Reason: extending a `ReturnType<…>` makes any internal hook refactor a public-API change, and reviewers can't see what consumers actually depend on.
- **Decomposition pattern.** When an orchestrator composes several pieces (the workout pattern), prefer:
  - **Pure reducer** for state transitions (`workoutReducer.ts`)
  - **State-owning sub-hooks** for ref guards + async coordination (`useWorkoutSave`)
  - **Pure helpers** for transformations (`xpProjection.ts`, `bodyProfileCapture.ts`)
  - **Thin orchestrator** wiring them
  Colocate them in `src/app/<feature>/` (precedent: `src/app/workout/`).

### Component purity rules (enforced by reviewers)

A component's job is layout, event wiring, and rendering — not arithmetic, not aggregation, not formula reinvention. PUS-16 lifted six inline calculations out of UI files (XP progress, weighted average, weekly chart aggregations, KPI deltas, number formatting, quest progress %); these invariants keep new ones from being added.

- **Components don't compute.** Pure data transforms — XP %, weighted averages, chart aggregations, number formatters, progress % — live in `@domain/` (e.g. `@domain/stats`, `@domain/scoring`, `@domain/xpSystem`, `@domain/quests`). Components import named helpers and consume the result. If you find yourself writing `Math.round(x / y * 100)` or `arr.reduce(...) / arr.length` inside a `.tsx`, the formula belongs in `@domain/<topic>.ts`.
- **Same formula in two places = one helper, two imports.** Before adding a calculation in a component or hook, grep `@domain/` for an existing helper with the same shape. Reinventing `weightedAverageScore` or `niceMax` because you didn't know it existed is the recurring failure mode.
- **Components don't read raw `DbUser` fields ad-hoc.** `DbUser` is a domain shape with sections (`profile`, `stats`, `progression`, plus top-level `achievements`/`records`/`bodyProfile`/`questProgress`). Access via `dbUser?.stats?.bestStreak`, `dbUser?.profile?.displayName`, etc. — never via flat-key fallbacks. The Firestore-flat shape is hidden behind `userRepository`'s `unfoldDbUser`. If a new field is needed, add it to the right section in `domain/authTypes.ts`, mirror it in `FlatUserDoc` (in `infra/firestoreValidators.ts`), wire the unfold mapper, then consume.
- **Boundary code can stay flat.** `useSyncCloud` reads raw flat fields via `onUserDoc(...) → Partial<FlatUserDoc>` because it IS the boundary — its job is to mirror Firestore changes into in-memory state. Don't generalize the flat-shape access pattern beyond that single sync hook.

### A11y rules (enforced by reviewers)

The app targets WCAG 2.1 AA. PUS-18 closed the obvious gaps (form errors not wired to inputs, animations ignoring `prefers-reduced-motion`, lazy modals flashing blank, screen transitions silent on screen readers, missing `<main>` landmark, clickable Avatar with no label). These invariants keep new ones from accruing.

- **Form errors are wired to inputs.** A visible error message gets an `id` and `role="alert"` (so it announces once when it appears). Every input the error applies to gets `aria-describedby={error ? '<error-id>' : undefined}` so SR users hear the error description when they land on the field. See the three modal forms (`AuthModal`, `PasswordChangeSection`, `DeleteAccountSection`) as the canonical pattern.
- **Animations honor `prefers-reduced-motion`.** `src/styles/_animations.scss` carries a global `@media (prefers-reduced-motion: reduce)` blanket that collapses every animation/transition to ~instant. New keyframes and transitions inherit it for free — don't add a `transition: …` outside the cascade. If an animation conveys *essential* information (rare — most UI motion is decorative), wrap the moving rule in `@media (prefers-reduced-motion: no-preference)` to opt back in explicitly.
- **Lazy boundaries get a real fallback.** Any `React.lazy()` rendered inside `<Suspense>` requires a non-null `fallback` (use `<ModalFallback />` for modals, equivalent for screens). `fallback={null}` produces a flash of blank — forbidden unless the load is provably sub-100ms.
- **Major screen transitions are announced.** Screens that appear as a result of a workflow step (rest, summary, level-up) carry `role="status" aria-live="polite"` on their root so SR users hear the new context. Prefer `polite` over `assertive` unless the message is urgent. For numeric content that updates every tick (countdowns), mark the digits `aria-hidden` so the live region only announces the static surrounding label, not the per-second value.
- **One `<main>` landmark per view.** It lives in `App.tsx`, wrapping the screen content (excluding the always-on `<video>` background and `<ReloadPrompt>` notification). `PageLayout` stays a `<div>` — it's reusable inside other landmark contexts, so it must not declare its own.
- **Clickable non-buttons need a label.** Any `<div role="button">`, icon-only `<button>`, or interactive non-text element requires `aria-label`. Prefer `<button type="button">` over a `<div>` when possible; `aria-label` is the patch when DOM constraints force the `div`.
- **Reuse the a11y mixins.** `src/styles/mixins/_a11y.scss` provides `focus-visible`, `hit-target`, `visually-hidden`. Use the existing mixin instead of hand-rolling — `visually-hidden` in particular is the right tool for SR-only labels (don't use `display: none`, which removes the element from the AT tree).

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

## Refactor hygiene

After any refactor that widens an invariant — a prop becomes constant, a conditional always evaluates one way, a type shrinks, a field is removed from an interface, a defaulted argument stops being overridden — invoke the `pr-review-toolkit:code-simplifier` agent on the changed files before reporting the work done. **Not optional on refactor commits.**

The agent's job is to chase the downstream consumers and surface dead branches the refactor left behind (`disabled={!flag}` gates where `flag` is now always `true`, label toggles whose false branch can't fire, `?:` optional props that every caller still passes, etc.). Without this pass, dead code leaks into PRs and the reviewer has to catch it — which defeats the point of the refactor being "clean".

Skip this only for pure additions (new file, new branch of a switch, new prop that nothing else touches) — those don't widen existing invariants.

### Module boundaries: barrels vs. shims

The rule is **one canonical import path per symbol**. Two patterns satisfy that, one violates it.

**✅ Architectural barrel (allowed).** A module exposes its public API via an `index.ts` (e.g. `src/domain/index.ts`), and consumers outside the module import from `@domain` only. This is *the* canonical path — `@domain/<file>` is reserved for intra-module imports. The barrel is the front door, not a back-compat layer; a symbol still has exactly one canonical home.

**❌ Migration shim (forbidden).** When a type or function moves to a new module, **update the imports in every consumer** rather than adding `export type { Foo } from '@new/location'` in the old module. The shim is a hidden second path: "find references" lies, the symbol's real home is opaque, and the indirection decays into permanent ambient noise. Touching N import lines is cheap; carrying a stale re-export forever is not.

**❌ Incidental re-export (forbidden).** A hook or component that re-exports a domain type it consumes (`export type { AppUser, DbUser } from '@domain/authTypes'` inside `useAuth.tsx`) is the same antipattern dressed up. The hook is not the home of those types; pruning the re-export is the fix, not a different formulation.

Heuristic: if the same symbol has two valid import paths and one of them isn't its source-of-truth module's barrel, you have a shim — delete it. The same rule applies to types you create *inside* a module (e.g. `firestoreValidators`'s `FlatUserDoc`) — consumers import from the source-of-truth module, not from a downstream module that happens to use the type.

**One import statement per source module.** When a file pulls multiple symbols from the same module, consolidate them into a single `import` line using inline `type` modifiers — never split values and types into two separate statements from the same path.

```ts
// ❌ Two lines from the same module
import type { DbUser } from '@domain';
import type { UserId } from '@domain';
import { createUserId } from '@domain';

// ✅ One consolidated line
import { createUserId, type DbUser, type UserId } from '@domain';
```

This is a hard rule the reviewer should flag: any file with two or more `from '<same-module>'` import statements is a defect, fix it on sight. Inline `type` modifiers (TS 4.5+) erase the same way `import type { … }` does, so consolidation is purely a readability win — no runtime cost, no bundler impact.

ESLint enforces this via `no-duplicate-imports` (`includeExports: true`) in `eslint.config.js` — `npm run lint` fails on any duplicate, including the `export { … } from './foo'` form in barrel files like `src/domain/index.ts`. Use `export { x, type Y } from './foo'` to combine value + type re-exports in a single statement.

### Brand at module boundaries

Identity strings and scalar metrics that flow across modules are branded in `@domain` (currently `UserId`, `Level`, `XpAmount` — see `src/domain/brands.ts`). This blocks two failure modes at compile time:
- Passing the wrong primitive: `userRef("display name")`, `getTier(totalXp)`, `levelFromTotalXp(level)`.
- Confusing two scalars of the same shape: `Level` vs `XpAmount` are both `number` but never assignable to each other.

Rules:
- **Mint at the boundary, never inside business logic.** The factories (`createUserId`, `createLevel`, `createXpAmount`) are called only at entry points: `authService.toAppUser` (Firebase Auth → AppUser), `userRepository.unfoldDbUser` (Firestore flat doc → DbUser), `firestoreValidators.parseNotification`, `friendRepository` (joining doc IDs to entities), the localStorage seed in `useLevelSystem`. After that, branded values flow through the codebase as branded values.
- **Re-mint after arithmetic.** A branded value plus a number is a number — TS strips the brand. When you must do arithmetic and re-emit a brand (e.g. `createLevel(currentLevel + 1)`, `createXpAmount(cloudXp + localXp)`), do it inline at the assignment site. Don't propagate stripped values further before re-minting.
- **No `as UserId` outside `brands.ts`.** Casts bypass validation. If you genuinely have a string you trust, use the factory.
- **Boundary code (`infra/firestoreValidators`, `useSyncCloud`) may still touch the wire-flat shape.** Those are *the* boundary. Branding happens as the value crosses out.

When adding a new branded type: define it in `brands.ts` with a factory that validates, propagate to the data shapes that already use the underlying primitive, and let the typechecker show you the call sites that need updates.

## Skills (Claude Code)

Custom skills in `.claude/skills/`:

- **`/audit`** — Architecture audit with 10 parallel subagents. Supports focused audits (`/audit performance`) or full audit. Outputs severity-rated findings with file:line references and a prioritized action plan.
- **`/fix`** — Structured bug-fixing workflow: Phase 1 (diagnostic + user confirmation) → Phase 2 (implementation + per-file review agent) → Phase 3 (cross-file regression agent + build/lint) → Phase 4 (summary + test instructions + commit suggestion).
