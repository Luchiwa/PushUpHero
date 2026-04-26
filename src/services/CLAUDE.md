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
| `guestStatsStore.ts` | Guest-mode achievement progress (storage via `@infra/storage`) |
| `guestMerge.ts` | Merge guest data to cloud on first login (storage via `@infra/storage`) |
| `workoutCheckpointStore.ts` | Interrupted workout checkpoint (storage via `@infra/storage`) |

## localStorage

All localStorage operations go through `@infra/storage`. That module owns the typed `STORAGE_KEYS` registry, the `STORAGE_KEY_BUILDERS` for parameterized keys, and the `read`/`write`/`remove`/`clearAppKeys`/`clearAll` API. Services in this directory are wrappers that decide *what* to persist; they never decide *how*.

The full layering rules (registry-only keys, no module-level mutable caches, prefix-based bulk clear) live in the root `CLAUDE.md` under "Storage isolation rules", and ESLint enforces no-direct-`localStorage` outside `src/infra/`.

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
