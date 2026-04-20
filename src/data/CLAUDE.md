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
