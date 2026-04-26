# Data — Firestore Read Repositories

All Firestore **read** operations (listeners and queries). Hooks import from `@data/` — never from `firebase/firestore` directly.

## Repository Files

| File | Exports | Pattern |
|------|---------|---------|
| `userRepository.ts` | `onUserProfile(uid, cb)`, `onUserDoc(uid, cb)` | `onSnapshot` listener |
| `sessionRepository.ts` | `onRecentSessions(uid, cb)`, `getSessionsByDateRange()`, `getOldestSessionDate()` | Listener + one-off queries |
| `friendRepository.ts` | `onFriendsList(uid, cb)`, `onIncomingRequests()`, `onOutgoingRequests()` | `onSnapshot` listeners |
| `activityRepository.ts` | `getRecentActivity(uid)` | One-off query |
| `notificationRepository.ts` | `onUnreadNotifications(uid, cb)` | `onSnapshot` listener |

## Conventions

- **Listener pattern**: Functions return an `unsubscribe` callback (from `onSnapshot`). Hooks call this in cleanup.
- **Ref builders**: Always use `@infra/refs` for document/collection references.
- **No writes**: This layer is strictly read-only. All writes go through `src/services/`.
- **Error handling**: Listeners silently log errors. Query functions throw (caller handles).

## Firestore boundary rules

- **Validators are mandatory.** Every doc read goes through a type guard from `@infra/firestoreValidators` (`isDbUser`, `isSessionRecord`, `isFriendRequest`, `parseNotification`, `parseActivityFeedDoc`) before any `as` cast. A doc that fails validation is filtered with `console.warn`, never propagated.
- **No Firebase types in public signatures.** Exported function params and return types must never reference `DocumentData`, `Timestamp`, `DocumentChange`, `QuerySnapshot`, `DocumentSnapshot`. Map to domain shapes inside the repo; coerce timestamps with `tsToMs` before they leave.
- **Synchronous listeners.** `onSnapshot` callbacks must not be `async` and must not call `getDoc`/`getDocs`. Async work belongs at write time (denormalize) or as a batched `where(documentId(), 'in', chunk)` query outside the snapshot callback (chunks of 30 — Firestore hard limit). See `onOutgoingRequests` for the optimistic-emit-then-enrich pattern.
