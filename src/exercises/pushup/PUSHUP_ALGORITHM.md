# Push-Up Detector — Algorithm Documentation

## Overview

The Push-Up Detector uses **MediaPipe Pose Landmarks** to track elbow flexion/extension as the primary signal for rep counting. It enforces a plank-like starting position during calibration and scores each rep on both **amplitude** (depth of descent) and **alignment** (form quality).

---

## 1. Landmarks Used

| Landmark | Index | Role |
| -------- | ----- | ---- |
| Left Shoulder | 11 | Alignment baseline, body-line reference |
| Right Shoulder | 12 | Alignment baseline, body-line reference |
| Left Elbow | 13 | Primary angle joint |
| Right Elbow | 14 | Primary angle joint |
| Left Wrist | 15 | Angle endpoint, calibration check |
| Right Wrist | 16 | Angle endpoint, calibration check |
| Left Hip | 23 | Hip sag / pike detection |
| Right Hip | 24 | Hip sag / pike detection |
| Left Ankle | 27 | Body-line reference |
| Right Ankle | 28 | Body-line reference |

All landmarks must have a **visibility score ≥ 0.4** to be processed.

---

## 2. Calibration Phase

### Goal
Detect a valid **plank position** and hold it for **90 consecutive frames** (~3 seconds at 30 fps).

### Validation Criteria

1. **Landmarks visible**: All 10 required landmarks pass the visibility threshold.
2. **Body horizontal**: The vertical distance between the average shoulder Y and average ankle Y is **< 25%** of the horizontal distance between them. This ensures the user's body is roughly horizontal (not standing).
3. **Wrists below shoulders**: Average wrist Y > average shoulder Y (in screen coordinates, Y increases downward), confirming the user's hands are on the ground.
4. **Arms extended**: The smoothed elbow angle must be **≥ 150°**, confirming the user is in the "up" position of a push-up.

### Calibration Coaching

The vocal coach provides guidance every 8 seconds if calibration is not yet complete:
- *"Get into plank position with arms extended"*
- *"Make sure your full body is visible"*
- *"Hold steady, almost there"*

Once 90 valid frames are counted, `isCalibrated` flips to `true` and the state machine transitions to the **up** phase.

---

## 3. State Machine

The detector operates as a three-phase state machine:

```
         ┌──────────┐
         │   idle   │  (before calibration)
         └────┬─────┘
              │ calibration complete
              ▼
         ┌──────────┐
    ┌───▶│    up    │◀───────────────┐
    │    └────┬─────┘                │
    │         │ elbow angle ≤ DOWN   │
    │         │ (≤ 140°)             │
    │         ▼                      │
    │    ┌──────────┐                │
    │    │   down   │────────────────┘
    │    └──────────┘   elbow angle ≥ UP
    │                    (≥ 155°)
    │                    → rep counted
    └────────────────────────────────┘
```

### Phase Transitions

| From | To | Condition |
| ---- | -- | --------- |
| `idle` | `up` | Calibration complete |
| `up` | `down` | Smoothed elbow angle **≤ 140°** |
| `down` | `up` | Smoothed elbow angle **≥ 155°** → **rep recorded** |

### Incomplete Rep Detection

When the user descends (`wasDescending = true`, angle drops below 140°) but then comes back up **without** reaching the DOWN threshold deeply enough or without completing the full extension:
- If `wasDescending` is true and the user returns to UP without a rep being recorded, an **incomplete rep feedback** is emitted (e.g., *"Go lower!"* or *"Full range of motion!"*).

---

## 4. Primary Signal — Elbow Angle

The **elbow angle** is computed for both arms as the angle at the elbow joint (vertex) formed by the shoulder→elbow→wrist vectors.

```
angle = computeAngle(shoulder, elbow, wrist)
```

The `computeAngle(a, b, c)` function from `BaseExerciseDetector` uses `Math.atan2` to calculate the angle at point **b** in degrees.

### Smoothing

A simple **exponential moving average** (EMA) is applied to reduce jitter:

```
smoothedAngle = α × rawAngle + (1 - α) × previousSmoothedAngle
```

where **α = 0.35** (SMOOTHING_FACTOR).

### Angle Thresholds

| Constant | Value | Meaning |
| -------- | ----- | ------- |
| `ANGLE_UP` | 155° | Arms nearly fully extended — "up" position |
| `ANGLE_DOWN` | 140° | Arms bent enough — entering "down" phase |
| `PERFECT_ANGLE` | 80° | Deep push-up — elbows at ~90° or below |

---

## 5. Scoring

Each rep receives a **total score** (0–100) composed of two equally weighted components:

```
totalScore = 0.5 × amplitudeScore + 0.5 × alignmentScore
```

### 5.1 Amplitude Score

Based on the **minimum elbow angle** recorded during the rep (the deepest point of descent):

| Depth | Score |
| ----- | ----- |
| minAngle ≤ PERFECT_ANGLE (80°) | **100** |
| minAngle between PERFECT and DOWN | Linear interpolation 50 → 100 |
| minAngle ≥ ANGLE_DOWN (140°) | **50** (minimum if rep counted) |

```
amplitudeScore = 50 + 50 × (ANGLE_DOWN - minAngle) / (ANGLE_DOWN - PERFECT_ANGLE)
```

### 5.2 Alignment Score

Evaluated at the moment the rep is recorded (transition from down → up), combining two sub-scores:

#### Arm Symmetry (50%)

Compares the left and right elbow angles at the time of scoring:

```
diff = |leftAngle - rightAngle|
armSymmetry = max(0, 100 - diff × 5)
```

Every degree of asymmetry costs 5 points.

#### Hip Deviation (50%)

Measures how far the hip midpoint deviates vertically from the shoulder–ankle midline:

```
midlineY = (avgShoulderY + avgAnkleY) / 2
deviation = |avgHipY - midlineY| / |avgShoulderY - avgAnkleY|
hipScore = max(0, 100 - deviation × 400)
```

A deviation of 25% of the body length → score of 0. This penalizes both **hip sag** (hips dropping) and **hip pike** (hips rising).

---

## 6. Feedback System

After each rep, the detector returns a `feedback` string selected by priority:

| Priority | Condition | Example Feedback |
| -------- | --------- | ---------------- |
| 1 (highest) | amplitudeScore < 60 | *"Go lower!"* or *"Chest to the ground!"* |
| 2 | hipScore < 60 | *"Keep your hips in line!"* or *"Don't let your hips sag!"* |
| 3 | armSymmetry < 70 | *"Even arms!"* or *"Balance both sides!"* |
| 4 | rep took > 4s | *"Pick up the pace!"* |
| 5 | totalScore ≥ 90 | *"Perfect form!"* |
| 6 (default) | totalScore ≥ 60 | *"Good rep!"* |

### Incomplete Rep Feedback

If the user starts descending but doesn't complete the rep:
- *"Go lower!"*, *"Full range of motion!"*, *"Don't stop halfway!"*, *"Complete the rep!"*

---

## 7. Anti-Cheat Measures

1. **Landmark Visibility**: All 10 landmarks must have visibility ≥ 0.4. If any are occluded, the frame is skipped entirely.
2. **Body Horizontal Check**: During calibration, the system verifies the body is horizontal (not standing upright trying to fake push-ups).
3. **Wrist Position Check**: Wrists must be below (Y >) shoulders during calibration, confirming hands are on the ground.
4. **Angle Hysteresis**: The UP (155°) and DOWN (140°) thresholds have a **15° gap** to prevent rapid oscillation from counting as reps.
5. **Smoothing Filter**: EMA with α=0.35 eliminates transient jitter spikes.

---

## 8. Grade Mapping

The average score across all reps maps to a letter grade:

| Grade | Score Range |
| ----- | ----------- |
| **S** | ≥ 90 |
| **A** | ≥ 75 |
| **B** | ≥ 60 |
| **C** | ≥ 45 |
| **D** | < 45 |
