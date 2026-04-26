# Domain — Game Design & Business Logic

Pure logic layer. Zero side effects, zero Firebase/browser API imports. Safe to import anywhere.

## XP System (`xpSystem.ts`)

### Per-Rep XP (by grade)
S: 20, A: 15, B: 12, C: 10, D: 8

### Difficulty Coefficients (from `exerciseDifficulty.ts`)
pushup: 1.3, squat: 1.0, pullup: 2.5, legraise: 1.1

### Level Curve
Soft-exponential: `XP_required(L) = 100 * L^1.5` (per level, cumulative).

### Session XP Calculation
```
rawXp = sum(reps * xpForRep(score)) * difficultyCoeff, per exercise
bonuses = streak(5%/level, max 50%) + duration(15-25%) + quality(20%) + goal(10%) + multi-exercise(10%)
totalXp = rawXp * (1 + sum(bonuses)/100)
```

### Tiers
`getTier(level)` → `'bronze' | 'silver' | 'gold' | 'platinum'`
- Bronze: 0-9, Silver: 10-24, Gold: 25-49, Platinum: 50+

## Grades (`constants.ts`)
Score thresholds: S >= 90, A >= 75, B >= 60, C >= 45, D < 45

`getGradeLetter(score)`, `getGradeColor(score)` (returns CSS var like `var(--grade-s)`), `getGradeClass(score)` (returns class like `grade-s`)

## Quests (`quests.ts`)

Two quest types:
- **Single-session**: All conditions must be met in one workout (flags: `singleSession`, `multiSet`, `multiExercise`)
- **Cross-session**: Progress accumulates across workouts (contribution = qualifying reps filtered by exerciseType/minAvgScore)

Key functions: `getQuestStatus()`, `getSessionQuestContribution()`, `getAcceptedQuests()`, `isQuestQuickStartable()`

Max accepted quests: `MAX_ACCEPTED_QUESTS` (constant)

## Achievements (`achievements.ts`, `achievementEngine.ts`)

Static `ACHIEVEMENTS` array with categories and tiers (bronze/silver/gold/platinum). Evaluated after each session save via `evaluateAchievements()`.

`TIER_COLORS` map must match SCSS tier palette (`$tier-bronze`, etc.)

## Scoring (`scoring.ts`)
`weightedAverageScore(sets)` — weighted by reps per set (a 20-rep set counts more than a 5-rep set).

## Types (`authTypes.ts`)
`AppUser` (Firebase Auth user wrapper), `DbUser` (nested domain shape: `{ uid, profile, stats, progression, achievements?, records?, bodyProfile?, questProgress? }`). The Firestore wire format is the flat `FlatUserDoc` (in `infra/firestoreValidators.ts`); `userRepository` unfolds flat → nested at the read boundary. Components reach for `dbUser.stats.bestStreak`, `dbUser.profile.displayName`, etc. — never flat keys.

## Stats helpers (`stats.ts`)
Pure helpers for the StatsScreen: `buildDayTotals`, `buildDayTotalsXp` (Sunday-anchored weekly aggregations, exercise-filterable), `niceMax` (axis tick rounding), `pctChange` (delta with null/100 edge cases), `compactNum` (>10k → "Nk"). Plus the `ExerciseFilter = 'all' | ExerciseType` type used by chart/KPI components.

## Level progress (`xpSystem.ts:computeXpProgress`)
`computeXpProgress(xpInto, xpNeeded) → { xpRemaining, progressRatio }` powers the HUD level ring + XP bar. `progressRatio` is a 0..1 ratio (LevelRing input), not a percentage.

## Quest progress (`quests.ts:computeQuestProgressPct`)
`computeQuestProgressPct(currentReps, goalReps, isCrossSession) → 0..100`. Returns 0 for single-session quests (their progress is all-or-nothing, not a bar).
