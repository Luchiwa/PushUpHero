# Leg Raise Detector — Algorithm Documentation

## Overview

The Leg Raise Detector uses **MediaPipe Pose Landmarks** to track hip flexion/extension as the primary signal for rep counting. The user lies on their back with the camera positioned to the side. It scores each rep on both **amplitude** (how high the legs are raised) and **alignment** (knee straightness and upper body stability).

Landmarks are pre-smoothed by a **One Euro Filter** (`src/infra/oneEuroFilter.ts`) in the pose detection pipeline before reaching the detector.

---

## 1. Landmarks Used

| Landmark | Index | Role |
| -------- | ----- | ---- |
| Left Shoulder | 11 | Hip angle computation, upper body stability |
| Right Shoulder | 12 | Hip angle computation, upper body stability |
| Left Hip | 23 | Primary angle joint (vertex) |
| Right Hip | 24 | Primary angle joint (vertex) |
| Left Knee | 25 | Knee straightness check |
| Right Knee | 26 | Knee straightness check |
| Left Ankle | 27 | Hip angle endpoint |
| Right Ankle | 28 | Hip angle endpoint |

**Post-calibration visibility check** (key landmarks): hips, knees, ankles — must have **visibility >= 0.6**.

---

## 2. Pre-Detection Guards

1. **Landmark plausibility** (`areLandmarksPlausible`): Core landmarks (shoulders + hips) must form a plausible body — bounding box < 60% of frame, not collapsed.
2. **Minimum landmarks**: At least 29 landmarks must be present.

---

## 3. Calibration Phase

### Goal
Detect a valid **lying flat** position and hold it for **90 consecutive frames** (~3 seconds at 30 fps). If a body profile already exists for leg raises, calibration completes in half the frames (~45).

### Validation Criteria

1. **Lower body visible**: Hip and ankle visibility > 0.5.
2. **Body horizontal**: Vertical distance between shoulders and ankles < 0.45 of frame height.
3. **Torso flat**: Shoulder-hip vertical distance < 0.15.
4. **Legs extended**: Smoothed hip angle > 145°.

### Calibration Data Capture & Finalization

Uses **median** of captured frames to compute:
- `calibratedMaxBodyVerticalSpread` = median spread + 0.25
- `calibratedMaxTorsoTilt` = median torso tilt + 0.10
- `calibratedBaselineShoulderY` = median shoulder Y (for detecting upper body lift)
- **Body profile ratios**: leg-to-torso ratio, natural hip extension

A **bounding box lock** is set from the calibration pose.

---

## 4. State Machine

```
         +----------+
         |   idle   |  (before calibration)
         +----+-----+
              | calibration complete
              v
         +----------+
    +--->|    up    |<---------------+
    |    +----+-----+                |
    |         | angle <= ANGLE_DOWN  |
    |         | (2 consecutive       |
    |         |  frames required)    |
    |         v                      |
    |    +----------+                |
    |    |   down   |----------------+
    |    +----------+  angle >= ANGLE_UP
    |         |         -> rep counted
    |    +----------+
    |    |transition|  (between thresholds)
    |    +----------+
    +--------------------------------+
```

**Note**: For leg raises, "up" = legs flat (rest position, high hip angle) and "down" = legs raised (work position, low hip angle).

### Phase Transitions

| From | To | Condition |
| ---- | -- | --------- |
| `idle` | `up` | Calibration complete |
| `up`/`transition` | `down` | Smoothed hip angle **<= ANGLE_DOWN** for **2 consecutive frames** |
| `down` | `up` | Smoothed hip angle **>= ANGLE_UP** + body horizontal -> **rep recorded** |
| any | `transition` | Between ANGLE_DOWN and ANGLE_UP thresholds |

### Debounce

Minimum **600ms** between reps prevents jitter-induced double-counting.

### Incomplete Rep Detection

If the user raises legs but returns to UP without reaching full raise depth (and `minAngleThisRep < 170`): *"Raise higher!"*.

---

## 5. Primary Signal — Hip Angle

The **hip angle** is computed for both sides as the angle at the hip joint (vertex) formed by the shoulder->hip->ankle vectors.

### Smoothing (two layers)

1. **One Euro Filter** (upstream): `min_cutoff=1.5, beta=0.5` applied to all landmarks.
2. **Visibility-weighted side selection + sliding window** (3 frames):
   - Both sides visible (hip+ankle visibility sum >= 0.8): weighted average
   - Otherwise: use more visible side
   - Then: 3-frame sliding window average

### Angle Thresholds

From `getLegRaiseThresholds()`. Defaults:

| Constant | Default Value | Meaning |
| -------- | ------------- | ------- |
| `angleUpThreshold` | ~155° | Legs nearly flat — rest position |
| `angleDownThreshold` | ~110° | Legs raised enough — in raise |
| `perfectAmplitudeAngle` | ~85° | Legs near vertical — perfect raise |

---

## 6. Scoring

Each rep receives a **total score** (0-100):

```
totalScore = 0.6 * amplitudeScore + 0.4 * alignmentScore
```

### 6.1 Amplitude Score

Based on the **minimum hip angle** during the rep:

| Depth | Score |
| ----- | ----- |
| minAngle <= perfectAmplitudeAngle | **100** |
| minAngle between perfect and down | Linear interpolation **0 -> 100** |
| minAngle >= angleDownThreshold | **0** |

### 6.2 Alignment Score

Combining two sub-scores (50/50):

#### Knee Straightness (50%)

```
kneeAngle >= 170 -> 100
kneeAngle 150-170 -> linear 0-100
kneeAngle < 150 -> 0
```

Penalizes bending the knees during the raise.

#### Shoulder Stability (50%)

```
shoulderRise <= 0.03 -> 100
shoulderRise > 0.03 -> max(0, 100 - ((rise - 0.03) / 0.06) * 100)
```

Penalizes the upper body lifting off the ground.

---

## 7. Feedback System

| Priority | Condition | Feedback |
| -------- | --------- | -------- |
| 1 | amplitude >= 90 AND alignment >= 85 | `perfect` |
| 2 | amplitudeScore < 60 | `raise_higher` |
| 3 | worst knee bend > 40° from straight | `keep_legs_straight` |
| 4 | worst shoulder rise > 0.075 | `keep_back_flat` |
| 5 | rep duration < 800ms | `too_fast` |
| 6 (default) | | `good` |

---

## 8. Anti-Cheat & Robustness

1. **One Euro Filter**: Upstream landmark smoothing eliminates jitter.
2. **Landmark Plausibility**: Rejects hallucinated/exploded skeletons.
3. **Bounding Box Lock**: After calibration, rejects poses drifting too far.
4. **Post-Calibration Visibility**: Key landmarks (hips, knees, ankles) must have visibility >= 0.6.
5. **Down Phase Hysteresis**: 2 consecutive frames below ANGLE_DOWN required.
6. **Rep Debounce**: Minimum 600ms between reps.
7. **Median Calibration**: Robust against outlier frames.
8. **Angle Hysteresis**: ~45° gap between UP and DOWN thresholds.
9. **Dynamic Calibration**: First 5 reps capture actual depth for adaptive thresholds.

---

## 9. Grade Mapping

| Grade | Score Range |
| ----- | ----------- |
| **S** | >= 90 |
| **A** | >= 75 |
| **B** | >= 60 |
| **C** | >= 45 |
| **D** | < 45 |
