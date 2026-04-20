# Infra — Platform Plumbing

Browser APIs, Firebase init, and low-level utilities. No business logic.

## Files

| File | Purpose |
|------|---------|
| `firebase.ts` | Firebase app init. Exports `auth`, `db`, `storage` singletons. |
| `refs.ts` | Centralized Firestore ref builders: `userRef(uid)`, `sessionsCol(uid)`, `friendRef(uid, fid)`, etc. |
| `device.ts` | Platform detection: `isMobile()`, `isIos()`, `isAndroid()`, `isSafari()` |
| `soundEngine.ts` | Web Audio API sound effects (rep beep, level-up, victory, achievement) |
| `speechEngine.ts` | Web Speech API wrapper for coaching voice |
| `coachEngine.ts` | Coach phrase selection + speech dispatch (maps RepFeedback to spoken phrases) |
| `avatarCache.ts` | Avatar URL caching via Cache API |
| `oneEuroFilter.ts` | One Euro Filter implementation for pose smoothing |

## Key Conventions

- **Firebase singletons**: Always import `auth`, `db`, `storage` from `@infra/firebase`. Never call `initializeApp()` elsewhere.
- **Firestore refs**: Always use `@infra/refs` builders. Never construct document/collection paths inline.
- **Sound init**: `initAudio()` must be called from a user gesture before any playback (Web Audio API requirement).
- **Speech**: `warmUpSpeech()` called at workout start to pre-initialize the speech engine.
- **One Euro Filter**: Adaptive smoothing — less lag during fast movements, more at rest. Parameters: `minCutoff` (jitter), `beta` (speed response), `dCutoff` (derivative).
