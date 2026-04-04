# 🏆 Achievements & Records – Design Document

> This file is the single source of truth for all achievements and records in PushUpHero.
> It is **not** parsed at runtime — the TypeScript registry in `achievements.ts` is the code equivalent.

---

## Architecture overview

| Concern | Where |
|---|---|
| Achievement definitions | `src/lib/achievements.ts` → `ACHIEVEMENTS` registry |
| User progress (unlocked, dates) | Firestore `users/{uid}` → `achievements` map |
| Records | Firestore `users/{uid}` → `records` map |
| Counters for social achievements | Firestore `users/{uid}` → `totalEncouragementsSent`, `bestStreak` |
| Unlock evaluation | `src/lib/achievementEngine.ts` → called after each session save |
| Toast during workout | Camera overlay → toast component |
| Summary display | SummaryScreen → newly unlocked badges |
| Progression screen | `src/screens/ProgressionScreen/` |

### Firestore shape (user profile additions)

```ts
// Added to users/{uid}
{
  bestStreak: number;                  // highest streak ever reached
  totalEncouragementsSent: number;     // lifetime encouragement count
  lifetimeTrainingTime: number;        // cumulative training time in seconds

  // Map of achievementId → unlock timestamp (millis)
  achievements: Record<string, number>;

  // Personal records
  records: {
    maxRepsInSession: Record<ExerciseType, { value: number; date: number; sessionId: string }>;
    longestWorkout: { value: number; date: number; sessionId: string };         // seconds
    bestGrade: { value: number; date: number; sessionId: string };              // score 0-100
    mostXpInSession: { value: number; date: number; sessionId: string };        // XP amount
    mostSessionsInWeek: { value: number; weekStart: string };                   // count
    longestStreak: { value: number; date: number };                             // days
  };
}
```

### Guest mode

Guests do **not** earn achievements. On first login, the merge flow will evaluate
all past local sessions and bulk-unlock any achievements that should have been earned.

---

## Achievement categories

| Category | Key | Emoji | Color accent |
|---|---|---|---|
| Strength | `strength` | 🏋️ | `#ef4444` (red) |
| Discipline | `discipline` | 📅 | `#3b82f6` (blue) |
| Social | `social` | 👥 | `#f59e0b` (amber) |
| Performance | `performance` | ⚡ | `#a855f7` (purple) |

---

## Rarity tiers

| Tier | Label | Color | Used for |
|---|---|---|---|
| `bronze` | Bronze | `#cd7f32` | Easy / first milestones |
| `silver` | Silver | `#c0c0c0` | Intermediate |
| `gold` | Gold | `#ffd700` | Hard / dedicated |
| `platinum` | Platinum | `#00e5ff` | Elite / completionist |

---

## Full achievement list

### 🏋️ Strength – Lifetime reps per exercise

For **each** exercise type (`pushup`, `squat`, `pullup`):

| ID pattern | Threshold | Tier | Title pattern | Description pattern |
|---|---|---|---|---|
| `{ex}_reps_50` | 50 | Bronze | 50 {Label} | Perform 50 {label} total |
| `{ex}_reps_100` | 100 | Bronze | 100 {Label} | Perform 100 {label} total |
| `{ex}_reps_250` | 250 | Silver | 250 {Label} | Perform 250 {label} total |
| `{ex}_reps_500` | 500 | Silver | 500 {Label} | Perform 500 {label} total |
| `{ex}_reps_1000` | 1 000 | Gold | 1K {Label} | Perform 1,000 {label} total |
| `{ex}_reps_2500` | 2 500 | Gold | 2.5K {Label} | Perform 2,500 {label} total |
| `{ex}_reps_5000` | 5 000 | Platinum | 5K {Label} | Perform 5,000 {label} total |
| `{ex}_reps_10000` | 10 000 | Platinum | 10K {Label} | Perform 10,000 {label} total |

**Total: 8 × 3 exercises = 24 achievements**

### 🏋️ Strength – Single-session reps per exercise

For **each** exercise type:

| ID pattern | Threshold | Tier | Title pattern |
|---|---|---|---|
| `{ex}_session_10` | 10 | Bronze | 10 {Label} in one session |
| `{ex}_session_25` | 25 | Silver | 25 {Label} in one session |
| `{ex}_session_50` | 50 | Gold | 50 {Label} in one session |
| `{ex}_session_75` | 75 | Gold | 75 {Label} in one session |
| `{ex}_session_100` | 100 | Platinum | 100 {Label} in one session |

**Total: 5 × 3 = 15 achievements**

### 📅 Discipline – Sessions count

| ID | Threshold | Tier | Title |
|---|---|---|---|
| `sessions_1` | 1 | Bronze | First Sweat |
| `sessions_10` | 10 | Bronze | Getting Started |
| `sessions_25` | 25 | Silver | Regular |
| `sessions_50` | 50 | Silver | Dedicated |
| `sessions_100` | 100 | Gold | Centurion |
| `sessions_250` | 250 | Gold | Machine |
| `sessions_500` | 500 | Platinum | Living Legend |

**Total: 7 achievements**

### 📅 Discipline – Best streak (consecutive days)

| ID | Threshold | Tier | Title |
|---|---|---|---|
| `streak_3` | 3 | Bronze | Three-peat |
| `streak_7` | 7 | Silver | Full Week |
| `streak_14` | 14 | Silver | Fortnight |
| `streak_30` | 30 | Gold | Monthly Warrior |
| `streak_60` | 60 | Gold | Iron Will |
| `streak_100` | 100 | Platinum | Unstoppable |

**Total: 6 achievements**

### 📅 Discipline – Cumulative training time

| ID | Threshold | Tier | Title | Description |
|---|---|---|---|---|
| `training_time_1800` | 30 min (1 800s) | Bronze | Warm Up | Cumulate 30 minutes of training |
| `training_time_3600` | 1 h (3 600s) | Bronze | One Hour Club | Cumulate 1 hour of training |
| `training_time_10800` | 3 h (10 800s) | Silver | Getting Serious | Cumulate 3 hours of training |
| `training_time_36000` | 10 h (36 000s) | Silver | Double Digits | Cumulate 10 hours of training |
| `training_time_86400` | 24 h (86 400s) | Gold | Full Day Warrior | Cumulate 24 hours of training |
| `training_time_180000` | 50 h (180 000s) | Gold | Half Centurion | Cumulate 50 hours of training |
| `training_time_360000` | 100 h (360 000s) | Platinum | Centurion of Time | Cumulate 100 hours of training |

**Total: 7 achievements**

### 📅 Discipline – Session endurance (single session duration)

| ID | Threshold | Tier | Title | Description |
|---|---|---|---|---|
| `session_duration_300` | 5 min (300s) | Bronze | Quick Burn | Complete a 5-minute session |
| `session_duration_600` | 10 min (600s) | Bronze | Steady Pace | Complete a 10-minute session |
| `session_duration_1200` | 20 min (1 200s) | Silver | Endurance Test | Complete a 20-minute session |
| `session_duration_1800` | 30 min (1 800s) | Silver | Half Hour Hero | Complete a 30-minute session |
| `session_duration_3600` | 60 min (3 600s) | Gold | Iron Hour | Complete a 60-minute session |
| `session_duration_5400` | 90 min (5 400s) | Platinum | Unstoppable | Complete a 90-minute session |

**Total: 6 achievements**

### 👥 Social – Friends

| ID | Threshold | Tier | Title |
|---|---|---|---|
| `friends_1` | 1 | Bronze | First Buddy |
| `friends_5` | 5 | Silver | Squad |
| `friends_10` | 10 | Gold | Crew |
| `friends_25` | 25 | Platinum | Community Leader |

**Total: 4 achievements**

### 👥 Social – Encouragements sent

| ID | Threshold | Tier | Title |
|---|---|---|---|
| `encouragements_1` | 1 | Bronze | Cheerleader |
| `encouragements_10` | 10 | Silver | Motivator |
| `encouragements_50` | 50 | Gold | Hype Machine |
| `encouragements_100` | 100 | Platinum | Inspiration |

**Total: 4 achievements**

### ⚡ Performance

| ID | Condition | Tier | Title |
|---|---|---|---|
| `grade_s` | Get an S grade on any workout | Bronze | Perfectionist |
| `grade_s_10` | Get S grade on 10 workouts | Silver | Consistent Excellence |
| `grade_s_50` | Get S grade on 50 workouts | Gold | Master of Form |
| `xp_session_100` | Earn 100+ XP in one session | Bronze | XP Burst |
| `xp_session_500` | Earn 500+ XP in one session | Silver | XP Storm |
| `xp_session_1000` | Earn 1,000+ XP in one session | Gold | XP Tsunami |
| `level_5` | Reach global level 5 | Bronze | Rising Star |
| `level_10` | Reach global level 10 | Silver | Veteran |
| `level_25` | Reach global level 25 | Gold | Elite |
| `level_50` | Reach global level 50 | Platinum | Legendary |

**Total: 10 achievements**

---

## Grand total: **83 achievements**

---

## Records list

| Record key | Label | Unit | Source |
|---|---|---|---|
| `maxRepsInSession.pushup` | Best Push-ups in a session | reps | `SessionRecord.reps` where `exerciseType === 'pushup'` |
| `maxRepsInSession.squat` | Best Squats in a session | reps | same |
| `maxRepsInSession.pullup` | Best Pull-ups in a session | reps | same |
| `longestWorkout` | Longest Workout | seconds | `SessionRecord.totalDuration \|\| elapsedTime` |
| `bestGrade` | Best Grade | score (0–100) | `SessionRecord.averageScore` |
| `mostXpInSession` | Most XP in a session | XP | `SessionRecord.xpEarned` |
| `mostSessionsInWeek` | Most Sessions in a Week | count | derived from session dates |
| `longestStreak` | Longest Streak | days | `bestStreak` field |

**Total: 8 records** (3 per-exercise + 5 global)

---

## UI flow

1. **Profile → "Progression" button** → opens `ProgressionScreen` (uses `PageLayout`)
2. **ProgressionScreen** has 3 sections (scrollable, or tabs):
   - **Levels**: global level card + per-exercise level cards with XP bars
   - **Achievements**: grid of badges, grouped by category, locked ones greyed out with progress bar
   - **Records**: stat cards with icon, value, and date
3. **During a session**: toast appears on camera overlay when an achievement unlocks
4. **SummaryScreen**: shows newly unlocked achievements at the bottom

---

## Evaluation triggers

| Trigger | What to check |
|---|---|
| After session save | All strength, discipline, performance achievements + all records |
| On friend list change | Social – friends achievements |
| On encouragement send | Social – encouragements achievements |
| On first login (merge) | Bulk-evaluate everything from local sessions |
