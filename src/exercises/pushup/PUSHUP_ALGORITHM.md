# Push-Up Detector — Algorithm Documentation

## Overview

The Push-Up Detector uses **MediaPipe Pose Landmarks** to track elbow flexion/extension as the primary signal for rep counting. It enforces a plank-like starting position during calibration and scores each rep on both **amplitude** (depth of descent) and **alignment** (form quality).

Landmarks are pre-smoothed by a **One Euro Filter** (`src/infra/oneEuroFilter.ts`) in the pose detection pipeline before reaching the detector. This eliminates high-frequency jitter while preserving fast movements.

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

**Post-calibration visibility check** (key landmarks): shoulders, elbows, hips — must have **visibility ≥ 0.6**.

---

## 2. Pre-Detection Guards

Before any processing, two guards run on every frame:

1. **Landmark plausibility** (`areLandmarksPlausible`): Core landmarks (shoulders + hips, indices 11/12/23/24) must be visible (≥ 0.5) and form a plausible body — core bounding box must not span > 60% of the frame nor be collapsed (< 1%).
2. **Minimum landmarks**: At least 29 landmarks must be present.

---

## 3. Calibration Phase

### Goal
Detect a valid **plank position** and hold it for **90 consecutive frames** (~3 seconds at 30 fps). If a body profile already exists for push-ups, calibration completes in half the frames (~45).

### Validation Criteria

1. **Body horizontal**: The vertical distance between the average shoulder Y and average ankle Y is **< 65%** of frame height (MAX_BODY_VERTICAL_SPREAD).
2. **Wrists below shoulders**: `midShoulderY - midWristY < -0.15` (in screen coordinates, Y increases downward).

### Calibration Data Capture

During each valid frame, the detector captures: body vertical spread, wrist offset, arm length, body spread, torso length, and smoothed elbow angle. These are stored for **median-based** finalization (robust against outlier frames).

### Calibration Finalization

Uses **median** of all captured frames (not average) to compute:
- `calibratedMaxBodyVerticalSpread` = median spread + 0.30
- `calibratedWristBelowShoulderMargin` = median wrist offset + 0.15
- `calibratedMaxTorsoTilt` = median torso length + 0.15
- **Body profile ratios**: arm-to-torso ratio, body spread ratio, natural elbow extension

A **bounding box lock** is set from the calibration pose to reject poses from different people (anti-cheat).

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
    │    │transition│  (between up/down thresholds)
    │    └──────────┘
    └────────────────────────────────┘
```

### Phase Transitions

| From | To | Condition |
| ---- | -- | --------- |
| `idle` | `up` | Calibration complete |
| `up`/`transition` | `down` | Smoothed elbow angle **≤ ANGLE_DOWN** for **2 consecutive frames** (hysteresis) |
| `down` | `up` | Smoothed elbow angle **≥ ANGLE_UP** + body horizontal → **rep recorded** |
| any | `transition` | Between ANGLE_DOWN and ANGLE_UP thresholds |

### Debounce

A minimum of **500ms** between reps (`MIN_REP_INTERVAL_MS`) prevents jitter-induced double-counting.

### Incomplete Rep Detection

When the user descends (`wasDescending = true`) but returns to UP without completing the full range of motion (and `minAngleThisRep < 170`), an incomplete rep feedback is emitted: *"Go lower!"*.

---

## 5. Primary Signal — Elbow Angle

The **elbow angle** is computed for both arms as the angle at the elbow joint (vertex) formed by the shoulder→elbow→wrist vectors.

### Smoothing (two layers)

1. **One Euro Filter** (upstream, per-landmark): Adaptive low-pass filter applied to all landmarks before the detector receives them. Parameters: `min_cutoff=1.5, beta=0.5`.
2. **Visibility-weighted side selection + sliding window** (in detector):
   - If both sides have good visibility (elbow+wrist sum ≥ 0.8): weighted average by visibility
   - Otherwise: use the more visible side
   - Then: sliding window average over **3 frames** (SMOOTHING_WINDOW)

### Angle Thresholds (adaptive)

Thresholds come from `getPushupThresholds(bodyProfile)` and adapt to the user's body. Defaults:

| Constant | Default Value | Meaning |
| -------- | ------------- | ------- |
| `angleUpThreshold` | ~155° | Arms nearly fully extended — "up" position |
| `angleDownThreshold` | ~140° | Arms bent enough — entering "down" phase |
| `perfectAmplitudeAngle` | ~80° | Deep push-up — elbows at ~90° or below |

---

## 6. Scoring

Each rep receives a **total score** (0–100):

```
totalScore = 0.6 × amplitudeScore + 0.4 × alignmentScore
```

### 6.1 Amplitude Score

Based on the **minimum elbow angle** recorded during the rep (the deepest point of descent):

| Depth | Score |
| ----- | ----- |
| minAngle ≤ perfectAmplitudeAngle | **100** |
| minAngle between perfect and down threshold | Linear interpolation **0 → 100** |
| minAngle ≥ angleDownThreshold | **0** |

### 6.2 Alignment Score

Combining two sub-scores (50/50):

#### Arm Symmetry (50%)

```
diff = |leftAngle - rightAngle|
armSymmetry = diff ≤ 15° ? 100 : max(0, 100 - ((diff - 15) / 30) × 100)
```

Tolerance of 15° before penalties begin.

#### Hip Deviation (50%)

Measures how far the hip midpoint deviates from the shoulder–ankle midline:

```
expectedHipY = (avgShoulderY + avgAnkleY) / 2
hipDeviation = avgHipY - expectedHipY
hipScore = |dev| ≤ 0.04 ? 100 : max(0, 100 - ((|dev| - 0.04) / 0.08) × 100)
```

Penalizes both **hip sag** (positive deviation) and **hip pike** (negative deviation).

---

## 7. Feedback System

After each rep, the detector returns a `RepFeedback` string selected by priority:

| Priority | Condition | Feedback |
| -------- | --------- | -------- |
| 1 | amplitude ≥ 90 AND alignment ≥ 85 | `perfect` |
| 2 | amplitudeScore < 60 | `go_lower` |
| 3 | worst hip deviation > 0.08 (sag) | `body_sagging` |
| 4 | worst hip deviation < -0.08 (pike) | `body_piking` |
| 5 | worst arm asymmetry > 30° | `arms_uneven` |
| 6 | rep duration < 800ms | `too_fast` |
| 7 (default) | | `good` |

---

## 8. Anti-Cheat & Robustness

1. **One Euro Filter**: Upstream landmark smoothing eliminates jitter without adding latency on fast movements.
2. **Landmark Plausibility**: Core bounding box check rejects hallucinated/exploded skeletons before processing.
3. **Bounding Box Lock**: After calibration, locks the user's position. Rejects poses that drift too far (center > 25%, size > ±45%). Slowly adapts to gradual movement.
4. **Post-Calibration Visibility**: Key landmarks (shoulders, elbows, hips) must have visibility ≥ 0.6.
5. **Down Phase Hysteresis**: 2 consecutive frames below ANGLE_DOWN required before confirming down phase.
6. **Rep Debounce**: Minimum 500ms between reps.
7. **Median Calibration**: Uses median (not average) of calibration frames — robust against outlier readings.
8. **Angle Hysteresis**: ANGLE_UP and ANGLE_DOWN thresholds have a ~15° gap to prevent oscillation.
9. **Dynamic Calibration**: First 5 reps capture the user's actual depth for adaptive threshold adjustment.

---

## 9. Grade Mapping

| Grade | Score Range |
| ----- | ----------- |
| **S** | ≥ 90 |
| **A** | ≥ 75 |
| **B** | ≥ 60 |
| **C** | ≥ 45 |
| **D** | < 45 |
