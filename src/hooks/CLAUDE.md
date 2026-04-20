# Hooks — Custom Hook Conventions

## Auth Hooks (`useAuth.tsx`)

Three separate contexts to prevent unrelated re-renders:

| Hook | Context | Fields |
|------|---------|--------|
| `useAuthCore()` | AuthCoreContext | `user`, `dbUser`, `loading`, `loginWithGoogle`, `logout`, `uploadAvatar` |
| `useLevel()` | LevelContext | `level`, `totalXp`, `xpIntoCurrentLevel`, `xpNeededForNextLevel`, `levelProgressPct`, `exerciseXp`, `addGuestXp` |
| `useSessions()` | SessionContext | `sessions`, `totalSessionCount` |

Never import from `firebase/auth` directly in hooks or components — use `useAuthCore()` or `authService.ts`.

## Shared Hooks (`shared/`)

### useRefSync
Keeps a ref in sync with a value. Use when you need the latest value inside a callback without adding it to dependency arrays.
```tsx
const ref = useRefSync(value);
// ref.current is always fresh
```

### useModalClose
Orchestrates exit animations for screens/modals:
```tsx
const { closing, handleClose, handleAnimationEnd } = useModalClose(onDone);
// closing → add CSS exit class → onAnimationEnd → calls onDone
```

### useBackButton
Captures Android/browser back button as in-app navigation. Uses a LIFO handler stack — last handler registered wins. Cleanup never touches `history` (race condition prevention).
```tsx
useBackButton(isActive, handleBack);
```

### useFocusTrap
Traps keyboard focus within a container (accessibility for modals/sheets).

## Data Hooks

| Hook | Layer | Purpose |
|------|-------|---------|
| `useSessionHistory` | data | Session list + `addSession()` (Firestore or localStorage for guests) |
| `useLevelSystem` | domain | Pure XP/level state holder. Firestore sync via `useSyncCloud` |
| `useQuestProgress` | domain | Quest accepted/completed state, persisted to localStorage |
| `useBodyProfile` | domain | Body profile (morphological calibration data) |
| `useFriends` | data | Friend list, requests, operations |
| `useActivityFeed` | data | Friend activity feed |
| `useNotifications` | data | Push notification state |
| `useCamera` | infra | Camera access, facing mode, stream management |
| `usePoseDetection` | infra | MediaPipe PoseLandmarker integration |
| `useExerciseDetector` | exercises | Detector lifecycle (create, calibrate, detect, reset) |
| `useSoundEffect` | infra | Thin wrapper around `soundEngine` module |
| `useInstallPrompt` | infra | PWA install prompt (beforeinstallprompt event) |
| `useSyncCloud` | services | Syncs XP/exerciseXp from localStorage to Firestore on login |
| `useWeekSessions` | data | Weekly session aggregation for stats charts |

## Patterns

- **Ref pattern for stale closures**: When a callback is created in `useCallback` and needs a value that changes between renders, store the value in a ref via `useRefSync` and read `ref.current` inside the callback. This avoids recreating the callback on every render.
- **Guard clauses**: Early-return if preconditions aren't met (e.g., `if (!user) return`).
- **Firestore reads in `src/data/`**: Hooks that listen to Firestore import from `@data/` repositories, never from `firebase/firestore` directly.
- **Firestore writes in `src/services/`**: Mutations go through service functions, never inline in hooks.
