# ☁️ PushUpHero — Cloud Functions

> Reference code: `functions/src/index.ts`
> Runtime: Node 20 · Firebase Functions v2 · Region: `europe-west1`

---

## Overview

PushUpHero uses three Firebase Cloud Functions:

| Function | Type | Schedule | Purpose |
| -------- | ---- | -------- | ------- |
| `sendPushNotification` | Firestore trigger | On document creation | Send push notifications (encouragements, friend requests) |
| `resetExpiredStreaks` | Scheduled (CRON) | Daily at **03:00 UTC** | Reset streaks for inactive users + purge old notifications |
| `sendStreakReminders` | Scheduled (CRON) | Daily at **18:00 UTC** | Remind users to protect their streak |

---

## 1. `sendPushNotification` — Firestore Trigger

### Trigger

Fires when a new document is created at:

```
users/{uid}/notifications/{notifId}
```

### How It Works

1. Reads the notification document data (`type`, `fromUsername`).
2. Fetches the recipient's `fcmToken` from their user profile.
3. Sends a **Web Push notification** via Firebase Cloud Messaging (FCM).
4. If the FCM token is expired or invalid, deletes it from the user profile to avoid retrying forever.

### Supported Notification Types

| Type | Title | Body |
| ---- | ----- | ---- |
| `encouragement` | 💪 Encouragement! | *"{username} believes in you — go crush it!"* |
| `friend_request` | 🤝 Friend request | *"{username} wants to be your friend!"* |

### Deep Link

- `friend_request` → opens `/#friends`
- All others → opens `/`

### Notification Lifecycle

Notification documents follow this lifecycle:

```
1. Client writes doc to users/{uid}/notifications/{id}
   └─ { type, fromUsername, sentAt, read: false }

2. Cloud Function triggers → sends FCM Web Push
   └─ Service Worker displays OS notification

3. If recipient's app is open:
   └─ onSnapshot listener detects the new doc (< 30s old) → deletes it immediately
   └─ No duplicate notification — FCM push is the only display channel

4. If recipient's app is closed:
   └─ Doc stays in Firestore until next app open or daily purge

5. Daily purge (03:00 UTC):
   └─ resetExpiredStreaks deletes all notification docs older than 7 days
```

> **Why no `read: true` step?** Previously, the client marked notifications as read and displayed a second native notification via `new Notification()`, causing duplicates. Now the FCM push (via Service Worker) is the **sole display channel**, and the Firestore doc is simply deleted once acknowledged.

---

## 2. `resetExpiredStreaks` — Scheduled Function

### Schedule

**Daily at 03:00 UTC** (05:00 Paris time)

### Purpose

Ensures streak values are accurate across the platform, even for users who haven't opened the app. Previously, streaks were only reset client-side when a user opened the app — meaning friends would see stale streak values.

### How It Works

1. Queries all users where `streak > 0`.
2. For each user, checks `lastSessionDate` against today and yesterday (UTC).
3. If `lastSessionDate` is **neither today nor yesterday**:
   - Updates `bestStreak` if the current streak exceeds it (preserves the personal record).
   - Resets `streak` to `0`.
4. All updates are batched for efficiency.

### Firestore Fields Used

| Field | Read/Write | Description |
| ----- | ---------- | ----------- |
| `streak` | R/W | Current consecutive-day streak |
| `lastSessionDate` | R | Last workout date (`YYYY-MM-DD` UTC) |
| `bestStreak` | R/W | All-time best streak (personal record) |

### Edge Cases

- Users with `lastSessionDate` = today or yesterday → **skipped** (streak still valid).
- Users with no `lastSessionDate` → streak is reset (they have `streak > 0` but no recorded session date, which is inconsistent).

### Step 2 — Purge Old Notifications

After resetting streaks, the same function purges stale notification documents:

1. Iterates over **all** user documents.
2. For each user, queries `notifications` where `sentAt` < **7 days ago**.
3. Deletes matching documents in batches (up to 500 per user per run).

This prevents the `notifications` subcollection from growing indefinitely. Fresh notifications (< 7 days) are kept in case the user hasn't opened the app yet.

---

## 3. `sendStreakReminders` — Scheduled Function

### Schedule

**Daily at 18:00 UTC** (20:00 Paris time)

### Purpose

Sends a motivational push notification to users who have an active streak but **haven't trained yet today**, giving them time to complete a session before the streak resets at 03:00 UTC.

### How It Works

1. Queries all users where `streak > 0`.
2. Filters out users who:
   - Have no `fcmToken` (push permission not granted) → skipped.
   - Have `lastSessionDate` = today (already trained) → skipped.
3. Picks a motivational message from a **tiered pool** based on streak length.
4. Sends a push notification via FCM.
5. Cleans up invalid/expired FCM tokens on failure.

### Message Tiers

Messages are selected randomly from a pool matched to the user's streak length:

| Streak | Tone | Example |
| ------ | ---- | ------- |
| **30+ days** | Legendary | *"🏆 {streak} days! That's elite-level commitment. Keep going, champion!"* |
| **14+ days** | Impressive | *"🚀 {streak} days! You're building something amazing — push through today!"* |
| **7+ days** | Excited | *"💥 {streak} days! You're on fire — don't let it go out!"* |
| **3+ days** | Encouraging | *"🎯 {streak} days! Small streaks become big ones — do a quick session!"* |
| **1+ day** | Gentle nudge | *"💪 Don't lose your momentum! A quick session keeps you on track."* |

### Notification Details

| Field | Value |
| ----- | ----- |
| Title | 🔥 Your streak is at risk! |
| Body | Tiered message (see above) |
| Tag | `streak_reminder` |
| Link | `/` (app home) |

---

## Shared Helpers

### `getFcmToken(uid)`

Reads the `fcmToken` field from `users/{uid}`. Returns `null` if the user document doesn't exist or no token is stored.

### `sendPush(token, title, body, type)`

Sends a Web Push notification via FCM with:
- `notification.title` and `notification.body` for the OS notification
- `data.type` for client-side routing
- PWA icon and badge (`/pwa-192x192.png`)
- `webpush.fcmOptions.link` for click-through navigation

### `todayUTC()` / `yesterdayUTC()`

Return date strings in `YYYY-MM-DD` format for UTC timezone. Used by both scheduled functions to compare against `lastSessionDate`.

---

## Deployment

From the project root:

```bash
npm run deploy:functions
```

This builds the TypeScript source (`functions/src/`) into JavaScript (`functions/lib/`) and deploys to Firebase.

---

## Error Handling

All three functions handle **invalid FCM tokens** gracefully:

1. Catch the FCM send error.
2. Check if the error message contains `registration-token-not-registered` or `invalid-registration-token`.
3. If so, delete the `fcmToken` field from the user profile to prevent future retries.
4. Other errors are logged to Cloud Functions console.
