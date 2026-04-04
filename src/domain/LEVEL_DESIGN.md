# 🎮 PushUpHero — Level Design

> This document is the **source of truth** for PushUpHero's experience and leveling system.
> Reference code: `src/lib/xpSystem.ts`

---

## 1. Base XP (per repetition)

Each rep earns XP based on its **quality score** (0–100):

| Grade | Required Score | XP per Rep |
| ----- | -------------- | ---------- |
| **S** | ≥ 90          | **20 XP**  |
| **A** | ≥ 75          | **15 XP**  |
| **B** | ≥ 60          | **12 XP**  |
| **C** | ≥ 45          | **10 XP**  |
| **D** | < 45          | **8 XP**   |

> A perfect rep (Grade S) is worth **2.5×** a weak rep (Grade D).
> Mental reference unit: 1 "average" rep (Grade C) = **10 XP**.

---

## 2. Difficulty Coefficient per Exercise

Applied **after** the grade-based XP calculation, **before** session bonuses.
Squat is the reference (×1.0).

| Exercise | Coefficient | Rationale |
| -------- | ----------- | --------- |
| **Squat**  | ×1.0 | Reference — large muscle group, accessible |
| **Push-up** | ×1.3 | Full upper body, stricter technique |
| **Pull-up** | ×2.5 | Full bodyweight, very few people can do 20+ |

### Comparative Examples (Grade C, no bonuses)

| Exercise | 20 reps × 10 XP × coeff | XP Earned |
| -------- | ----------------------- | --------- |
| Squat   | 20 × 10 × 1.0 | **200 XP** |
| Push-up | 20 × 10 × 1.3 | **260 XP** |
| Pull-up | 20 × 10 × 2.5 | **500 XP** |

> **Calculation order:** Grade XP → × difficulty coefficient → × session bonus multiplier

---

## 3. Level Curve

### Formula

XP required to advance from level `L-1` to level `L`:

$$XP_{level}(L) = 100 \times L^{1.5}$$

Cumulative total XP to **reach** level `L`:

$$XP_{total}(L) = \sum_{i=1}^{L} \lfloor 100 \times i^{1.5} \rceil$$

### Reference Table

| Level | XP for This Level | Cumulative Total XP | ≈ Grade C Reps |
| ----- | ----------------- | ------------------- | -------------- |
| 1     | 100               | 100                 | 10             |
| 2     | 283               | 383                 | ~28            |
| 3     | 520               | 903                 | ~52            |
| 5     | 1,118             | 2,735               | ~112           |
| 10    | 3,162             | 14,604              | ~316           |
| 15    | 5,809             | 36,949              | ~581           |
| 20    | 8,944             | 70,862              | ~894           |
| 30    | 16,432            | 173,205             | ~1,643         |
| 50    | 35,355            | 530,338             | ~3,536         |
| 100   | 100,000           | 2,026,760           | ~10,000        |

> **No level cap.** Progression is infinite.

---

## 4. Per-Exercise Levels (Sub-levels)

Each exercise type has **its own level** using **the same curve**:

- **Push-up Level** — fed by push-up reps
- **Squat Level** — fed by squat reps
- *(future: Lunges, Plank, Sit-ups…)*

### Dual Feeding

XP earned from an exercise feeds **two gauges**:

1. ✅ The exercise's **sub-level** gauge (+100% of the XP)
2. ✅ The **global level** gauge (+100% of the XP)

> Example: 1 push-up rep at Grade A = **+15 XP Push-up** AND **+15 XP Global**.

---

## 5. XP Bonuses (Session Multipliers)

Bonuses are calculated at **end of session** and apply to the total raw XP.

| Bonus | Condition | Bonus |
| ----- | --------- | ----- |
| 🔥 **Streak** | Active streak (consecutive days) | +5% per day (cap **+50%** at 10d) |
| ⏱️ **Endurance** | Session ≥ 10 minutes | **+15%** |
| ⏱️ **Marathon** | Session ≥ 20 minutes | **+25%** *(replaces Endurance)* |
| 💯 **Perfection** | Average score ≥ 90 (Grade S) | **+20%** |
| 🎯 **Goal Met** | 100% of goals completed | **+10%** |
| 🏋️ **Multi-exercise** | Workout with 2+ exercise types | **+10%** |
| 👥 **Friend Challenge** *(future)* | Complete a friend's challenge | **+25%** |

### Calculation

Bonuses are **additive**, then multiplied as a single factor:

```
Final XP = Raw XP × (1 + sum of bonus%)
```

### Concrete Example

> Session: 30 push-ups (average score 82, Grade A), 5-day streak, 12 minutes, all goals met.
>
> - Raw XP: 30 × 15 = **450 XP**
> - 5d Streak: +25%
> - Endurance: +15%
> - Goal Met: +10%
> - Total multiplier: ×1.50
> - **Final XP: 450 × 1.50 = 675 XP**

---

## 6. Session XP Flow

```
Session ended
  │
  ├─ For each rep → Base XP by grade (8/10/12/15/20)
  │
  ├─ × Exercise difficulty coefficient (squat×1.0 / pushup×1.3 / pullup×2.5)
  │
  ├─ Sum = Weighted session XP (= exposed rawXp)
  │
  ├─ Calculate active bonuses → total multiplier
  │
  ├─ Final XP = Weighted XP × multiplier (rounded)
  │
  ├─ Breakdown by exercise:
  │    ├─ Push-up XP += weighted push-up XP × multiplier
  │    ├─ Squat XP  += weighted squat XP × multiplier
  │    └─ Pull-up XP += weighted pull-up XP × multiplier
  │
  └─ Global XP += total final XP
```

---

## 7. Data Storage

### User Profile in Firestore (`users/{uid}`)

| Field | Type | Description |
| ----- | ---- | ----------- |
| `totalXp` | `number` | Cumulative global XP (lifetime) |
| `level` | `number` | Global level (derived, denormalized) |
| `exerciseXp` | `Record<ExerciseType, number>` | XP per exercise (`{ pushup: 1200, squat: 800 }`) |
| `exerciseLevels` | `Record<ExerciseType, number>` | Level per exercise (denormalized) |

### Session (`users/{uid}/sessions/{id}`)

| Additional Field | Type | Description |
| ----- | ---- | ----------- |
| `xpEarned` | `number` | Total XP earned (after bonuses) |
| `xpRaw` | `number` | Raw XP (before bonuses) |
| `xpMultiplier` | `number` | Applied multiplier |
| `xpBonuses` | `XpBonusDetail[]` | Details of active bonuses |
| `xpPerExercise` | `XpPerExercise[]` | XP breakdown by exercise |

### Guest Mode (localStorage)

| Key | Value |
| --- | ----- |
| `pushup_hero_total_xp` | Cumulative global XP |
| `pushup_hero_exercise_xp` | JSON `Record<ExerciseType, number>` |

---

## 8. Changelog

| Date | Change |
| ---- | ------ |
| 2026-03-22 | Created XP system (replaced reps→level system) |
| 2026-03-23 | Added difficulty coefficients per exercise (squat×1.0 / pushup×1.3 / pullup×2.5) |
