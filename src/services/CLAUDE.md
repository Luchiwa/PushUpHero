# Services — Firebase Writes & Persistence

Pure functions with no React dependency. All Firestore/Auth/Storage mutations live here.

## Service Files

| File | Responsibility |
|------|---------------|
| `authService.ts` | All Firebase Auth operations: `subscribeAuthState`, `signInWithGoogle`, `loginWithEmail`, `logoutSession`, `registerWithEmail`, `changePassword`, `reauthenticate*`, `translateAuthError`. Maps `firebase/auth.User` → `AppUser` at the boundary. **Sole authorized importer of `firebase/auth` outside `src/infra/`.** |
| `userService.ts` | Profile writes. Does NOT handle sessions (see `sessionService`). |
| `sessionService.ts` | `saveSession()` — atomic Firestore batch: session doc + profile update + activity feed + achievements + records |
| `friendService.ts` | Friend request lifecycle, `batchFetchProfileStats()` |
| `avatarService.ts` | Avatar upload/compression to Firebase Storage |
| `notificationService.ts` | FCM token registration, notification writes |
| `achievementService.ts` | Achievement evaluation and unlocking |
| `profileService.ts` | Profile field updates |
| `deleteAccount.ts` | Account deletion orchestration |
| `guestStatsStore.ts` | Guest mode persistence (localStorage) |
| `guestMerge.ts` | Merge guest data to cloud on first login |
| `clearLocalStorage.ts` | Central cleanup for all app localStorage keys |
| `workoutCheckpointStore.ts` | Interrupted workout checkpoint persistence |

## localStorage Conventions

- **Key prefix**: `pushup_hero_` or `pushup-hero-` (legacy)
- **Helper pattern** (from `guestStatsStore.ts`):
  ```typescript
  readJSON<T>(key, fallback): T    // JSON.parse with try/catch
  writeJSON(key, value): void      // JSON.stringify with quota handling
  readInt(key, fallback): number   // parseInt with fallback
  writeInt(key, value): void       // toString with try/catch
  ```
- **All keys must be registered** in `clearLocalStorage.ts` `APP_STORAGE_KEYS` array
- **Guest data**: Separate keys under `pushup_hero_guest_*`, merged on login via `guestMerge.ts`

### Known Keys
```
pushup-hero-body-profile        Body profile
pushup-hero-quest-progress      Quest state
pushup_hero_total_xp            Total XP
pushup_hero_exercise_xp         Per-exercise XP map
pushup-sessions                 Local session records
pushup_game_total_sessions      Session count
pushup_game_total_reps          Lifetime reps
pushup_merge_in_progress        Merge lock flag
pushup_hero_workout_checkpoint  Interrupted workout checkpoint
feed_last_seen_{uid}            Dynamic per-user feed timestamp
```

## Firestore Atomic Save (`sessionService.ts`)

`saveSession()` writes everything in a single `batch.commit()`:
1. Session document
2. User profile update (XP, level, streak, stats, achievements, records)
3. Activity feed event
4. Fire-and-forget: old feed pruning (>30 days)

This ensures consistency — if any write fails, nothing is persisted.

## Read/Write Boundary

- **Reads** (`src/data/`): Repository pattern with Firestore listeners (`onSnapshot`). Hooks import from `@data/`.
- **Writes** (`src/services/`): Pure functions called by hooks/handlers. Never import Firestore directly in components.
