# Squat Detector — Algorithm Documentation

## Overview

The Squat Detector uses **MediaPipe Pose Landmarks** to track knee flexion/extension as the primary signal for rep counting. It enforces an upright standing position during calibration and scores each rep on both **amplitude** (squat depth) and **alignment** (knee tracking and torso lean).

Landmarks are pre-smoothed by a **One Euro Filter** (`src/infra/oneEuroFilter.ts`) in the pose detection pipeline before reaching the detector.

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

**Post-calibration visibility check** (key landmarks): hips, knees, ankles — must have **visibility ≥ 0.6**.

---

## 2. Pre-Detection Guards

1. **Landmark plausibility** (`areLandmarksPlausible`): Core landmarks (shoulders + hips) must form a plausible body — bounding box < 60% of frame, not collapsed.
2. **Minimum landmarks**: At least 29 landmarks must be present.

---

## 3. Calibration Phase

### Goal
Detect a valid **standing position** and hold it for **90 consecutive frames** (~3 seconds at 30 fps). If a body profile already exists for squats, calibration completes in half the frames (~45).

### Validation Criteria

1. **Lower body visible**: Knee and ankle visibility > 0.5 (`MIN_LANDMARK_VISIBILITY`).
2. **Upright posture** (vertical ordering): `avgShoulderY < avgHipY < avgKneeY < avgAnkleY`.
3. **Body spread**: Vertical distance between shoulders and ankles > 0.35 of frame height.
4. **Shoulders above hips**: `midHipY - midShoulderY > 0.04`.
5. **Legs straight**: Smoothed knee angle > 160° (`DEFAULT_ANGLE_UP_THRESHOLD`).

### Calibration Data Capture & Finalization

Uses **median** of captured frames to compute:
- `calibratedMinBodyVerticalSpread` = median spread × 0.4
- `calibratedShoulderAboveHipMargin` = median shoulder-hip diff × 0.3
- **Body profile ratios**: leg-to-torso ratio, natural knee extension, stance width ratio

A **bounding box lock** is set from the calibration pose.

---

## 4. State Machine

```
         ┌──────────┐
         │   idle   │  (before calibration)
         └────┬─────┘
              │ calibration complete
              ▼
         ┌──────────┐
    ┌───▶│    up    │◀───────────────┐
    │    └────┬─────┘                │
    │         │ angle ≤ ANGLE_DOWN   │
    │         │ (2 consecutive       │
    │         │  frames required)    │
    │         ▼                      │
    │    ┌──────────┐                │
    │    │   down   │────────────────┘
    │    └──────────┘  angle ≥ ANGLE_UP
    │         │         → rep counted
    │    ┌──────────┐
    │    │transition│  (between thresholds)
    │    └──────────┘
    └────────────────────────────────┘
```

### Phase Transitions

| From | To | Condition |
| ---- | -- | --------- |
| `idle` | `up` | Calibration complete |
| `up`/`transition` | `down` | Smoothed knee angle **≤ ANGLE_DOWN** for **2 consecutive frames** |
| `down` | `up` | Smoothed knee angle **≥ ANGLE_UP** + upright → **rep recorded** |
| any | `transition` | Between ANGLE_DOWN and ANGLE_UP thresholds |

### Debounce

Minimum **600ms** between reps prevents jitter-induced double-counting.

### Incomplete Rep Detection

If the user descends but returns to UP without reaching full squat depth (and `minAngleThisRep < 170`): *"Go deeper!"*.

---

## 5. Primary Signal — Knee Angle

The **knee angle** is computed for both legs as the angle at the knee joint (vertex) formed by the hip→knee→ankle vectors.

### Smoothing (two layers)

1. **One Euro Filter** (upstream): `min_cutoff=1.5, beta=0.5` applied to all landmarks.
2. **Visibility-weighted side selection + sliding window** (3 frames):
   - Both sides visible (knee+ankle visibility sum ≥ 0.8): weighted average
   - Otherwise: use more visible side
   - Then: 3-frame sliding window average

### Angle Thresholds (adaptive)

From `getSquatThresholds(bodyProfile)`. Defaults:

| Constant | Default Value | Meaning |
| -------- | ------------- | ------- |
| `angleUpThreshold` | ~160° | Legs nearly fully extended — standing |
| `angleDownThreshold` | ~110° | Knees bent enough — in squat |
| `perfectAmplitudeAngle` | ~80° | Deep squat — thighs below parallel |

---

## 6. Scoring

Each rep receives a **total score** (0–100):

```
totalScore = 0.6 × amplitudeScore + 0.4 × alignmentScore
```

### 6.1 Amplitude Score

Based on the **minimum knee angle** during the rep:

| Depth | Score |
| ----- | ----- |
| minAngle ≤ perfectAmplitudeAngle | **100** |
| minAngle between perfect and down | Linear interpolation **0 → 100** |
| minAngle ≥ angleDownThreshold | **0** |

### 6.2 Alignment Score

Combining two sub-scores (50/50):

#### Knee Tracking (50%)

```
kneeDeviation = |kneeMidX - ankleMidX|
kneeScore = dev ≤ 0.04 ? 100 : max(0, 100 - ((dev - 0.04) / 0.08) × 100)
```

Penalizes knees caving inward or flaring outward.

#### Torso Lean (50%)

```
torsoLean = |shoulderMidX - hipMidX|
torsoScore = lean ≤ 0.03 ? 100 : max(0, 100 - ((lean - 0.03) / 0.07) × 100)
```

Penalizes excessive forward lean.

---

## 7. Feedback System

| Priority | Condition | Feedback |
| -------- | --------- | -------- |
| 1 | amplitude ≥ 90 AND alignment ≥ 85 | `perfect` |
| 2 | amplitudeScore < 60 | `go_lower` |
| 3 | worst knee deviation > 0.10 | `knees_caving` |
| 4 | worst torso lean > 0.075 | `lean_forward` |
| 5 | rep duration < 800ms | `too_fast` |
| 6 (default) | | `good` |

---

## 8. Anti-Cheat & Robustness

1. **One Euro Filter**: Upstream landmark smoothing eliminates jitter.
2. **Landmark Plausibility**: Rejects hallucinated/exploded skeletons.
3. **Bounding Box Lock**: After calibration, rejects poses drifting too far.
4. **Post-Calibration Visibility**: Key landmarks (hips, knees, ankles) must have visibility ≥ 0.6.
5. **Down Phase Hysteresis**: 2 consecutive frames below ANGLE_DOWN required.
6. **Rep Debounce**: Minimum 600ms between reps.
7. **Median Calibration**: Robust against outlier frames.
8. **Angle Hysteresis**: ~50° gap between UP and DOWN thresholds.
9. **Dynamic Calibration**: First 5 reps capture actual depth for adaptive thresholds.

---

## 9. Grade Mapping

| Grade | Score Range |
| ----- | ----------- |
| **S** | ≥ 90 |
| **A** | ≥ 75 |
| **B** | ≥ 60 |
| **C** | ≥ 45 |
| **D** | < 45 |
