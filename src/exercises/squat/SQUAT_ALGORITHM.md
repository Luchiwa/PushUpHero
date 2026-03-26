# Squat Detector — Algorithm Documentation

## Overview

The Squat Detector uses **MediaPipe Pose Landmarks** to track knee flexion/extension as the primary signal for rep counting. It enforces an upright standing position during calibration and scores each rep on both **amplitude** (squat depth) and **alignment** (knee tracking and torso lean).

---

## 1. Landmarks Used

| Landmark | Index | Role |
| -------- | ----- | ---- |
| Left Shoulder | 11 | Torso lean reference |
| Right Shoulder | 12 | Torso lean reference |
| Left Hip | 23 | Knee angle computation, torso lean |
| Right Hip | 24 | Knee angle computation, torso lean |
| Left Knee | 25 | Primary angle joint |
| Right Knee | 26 | Primary angle joint |
| Left Ankle | 27 | Knee angle endpoint, knee tracking |
| Right Ankle | 28 | Knee angle endpoint, knee tracking |

All landmarks must have a **visibility score ≥ 0.4** to be processed.

---

## 2. Calibration Phase

### Goal
Detect a valid **standing position** and hold it for **90 consecutive frames** (~3 seconds at 30 fps).

### Validation Criteria

1. **Landmarks visible**: All 8 required landmarks pass the visibility threshold.
2. **Upright posture** (vertical ordering): The average Y coordinates must satisfy:
   ```
   avgShoulderY < avgHipY < avgKneeY < avgAnkleY
   ```
   This ensures the user is standing upright with the camera showing their full body from the side or front.
3. **Legs straight**: The smoothed knee angle must be **≥ 155°**, confirming the user is standing with legs extended.

### Calibration Coaching

The vocal coach provides guidance every 8 seconds:
- *"Stand up straight with your feet shoulder-width apart"*
- *"Make sure your full body is visible"*
- *"Hold steady, almost there"*

Once 90 valid frames are counted, `isCalibrated` flips to `true` and the state machine transitions to the **up** phase (standing).

---

## 3. State Machine

```
         ┌──────────┐
         │   idle   │  (before calibration)
         └────┬─────┘
              │ calibration complete
              ▼
         ┌──────────┐
    ┌───▶│    up    │◀───────────────┐
    │    └────┬─────┘                │
    │         │ knee angle ≤ DOWN    │
    │         │ (≤ 110°)             │
    │         ▼                      │
    │    ┌──────────┐                │
    │    │   down   │────────────────┘
    │    └──────────┘   knee angle ≥ UP
    │                    (≥ 160°)
    │                    → rep counted
    └────────────────────────────────┘
```

### Phase Transitions

| From | To | Condition |
| ---- | -- | --------- |
| `idle` | `up` | Calibration complete |
| `up` | `down` | Smoothed knee angle **≤ 110°** |
| `down` | `up` | Smoothed knee angle **≥ 160°** → **rep recorded** |

### Incomplete Rep Detection

When the user descends (`wasDescending = true`) but comes back up without completing the full range of motion, an incomplete rep feedback is emitted:
- *"Go deeper!"*, *"Full squat!"*, *"Don't stop halfway!"*, *"Complete the rep!"*

---

## 4. Primary Signal — Knee Angle

The **knee angle** is computed for both legs as the angle at the knee joint (vertex) formed by the hip→knee→ankle vectors.

```
angle = computeAngle(hip, knee, ankle)
```

### Smoothing

Exponential moving average (EMA):

```
smoothedAngle = α × rawAngle + (1 - α) × previousSmoothedAngle
```

where **α = 0.35** (SMOOTHING_FACTOR).

### Angle Thresholds

| Constant | Value | Meaning |
| -------- | ----- | ------- |
| `ANGLE_UP` | 160° | Legs nearly fully extended — standing position |
| `ANGLE_DOWN` | 110° | Knees bent enough — entering squat |
| `PERFECT_ANGLE` | 80° | Deep squat — thighs below parallel |

---

## 5. Scoring

Each rep receives a **total score** (0–100) composed of two equally weighted components:

```
totalScore = 0.5 × amplitudeScore + 0.5 × alignmentScore
```

### 5.1 Amplitude Score

Based on the **minimum knee angle** recorded during the rep (the deepest squat point):

| Depth | Score |
| ----- | ----- |
| minAngle ≤ PERFECT_ANGLE (80°) | **100** |
| minAngle between PERFECT and DOWN | Linear interpolation 50 → 100 |
| minAngle ≥ ANGLE_DOWN (110°) | **50** (minimum if rep counted) |

```
amplitudeScore = 50 + 50 × (ANGLE_DOWN - minAngle) / (ANGLE_DOWN - PERFECT_ANGLE)
```

### 5.2 Alignment Score

Evaluated at the moment the rep is recorded, combining two sub-scores:

#### Knee Tracking (50%)

Checks whether the knees stay aligned over the ankles (not caving inward or flaring outward):

```
leftKneeOffset  = |leftKnee.x  - leftAnkle.x|
rightKneeOffset = |rightKnee.x - rightAnkle.x|
avgOffset = (leftKneeOffset + rightKneeOffset) / 2
kneeTrackingScore = max(0, 100 - avgOffset × 500)
```

A lateral knee deviation of 0.2 (in normalized coordinates) results in a score of 0.

#### Torso Lean (50%)

Measures how far the torso deviates from vertical. The torso vector runs from hip midpoint to shoulder midpoint:

```
dx = |avgShoulderX - avgHipX|
dy = |avgShoulderY - avgHipY|
lean = dx / max(dy, 0.01)       // ratio of horizontal to vertical displacement
torsoLeanScore = max(0, 100 - lean × 200)
```

A lean ratio of 0.5 (significant forward lean) results in a score of 0.

---

## 6. Feedback System

After each rep, feedback is selected by priority:

| Priority | Condition | Example Feedback |
| -------- | --------- | ---------------- |
| 1 (highest) | amplitudeScore < 60 | *"Go deeper!"* or *"Thighs below parallel!"* |
| 2 | kneeTrackingScore < 60 | *"Keep knees over toes!"* or *"Don't let knees cave in!"* |
| 3 | torsoLeanScore < 60 | *"Keep your chest up!"* or *"Stay upright!"* |
| 4 | rep took > 4s | *"Pick up the pace!"* |
| 5 | totalScore ≥ 90 | *"Perfect form!"* |
| 6 (default) | totalScore ≥ 60 | *"Good rep!"* |

### Incomplete Rep Feedback

If the user starts descending but doesn't reach the full squat depth:
- *"Go deeper!"*, *"Full squat!"*, *"Don't stop halfway!"*, *"Complete the rep!"*

---

## 7. Anti-Cheat Measures

1. **Landmark Visibility**: All 8 landmarks must have visibility ≥ 0.4. Frames with occluded landmarks are skipped.
2. **Upright Check**: During calibration, vertical ordering of body segments ensures the user is standing, not lying down or sitting.
3. **Legs Straight Check**: Knee angle ≥ 155° during calibration confirms neutral starting position.
4. **Angle Hysteresis**: UP (160°) and DOWN (110°) thresholds have a **50° gap** to prevent micro-movements from counting as reps.
5. **Smoothing Filter**: EMA with α=0.35 eliminates noise-induced false transitions.

---

## 8. Grade Mapping

| Grade | Score Range |
| ----- | ----------- |
| **S** | ≥ 90 |
| **A** | ≥ 75 |
| **B** | ≥ 60 |
| **C** | ≥ 45 |
| **D** | < 45 |
