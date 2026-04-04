# Pull-Up Detector — Algorithm Documentation

## Overview

The Pull-Up Detector uses a **dual-signal approach** combining **shoulder vertical displacement** (primary) with **elbow angle confirmation** (secondary). Unlike push-ups and squats which rely solely on joint angles, pull-ups require tracking how much the body rises relative to a calibrated dead-hang baseline. This is necessary because the camera typically captures only the upper body during pull-ups, making pure angle-based detection unreliable.

Landmarks are pre-smoothed by a **One Euro Filter** (`src/infra/oneEuroFilter.ts`) in the pose detection pipeline before reaching the detector.

---

## 1. Landmarks Used

| Landmark | Index | Role |
| -------- | ----- | ---- |
| Left Shoulder | 11 | Primary signal (vertical displacement), alignment |
| Right Shoulder | 12 | Primary signal (vertical displacement), alignment |
| Left Elbow | 13 | Secondary confirmation (elbow angle) |
| Right Elbow | 14 | Secondary confirmation (elbow angle) |
| Left Wrist | 15 | Elbow angle endpoint, calibration check |
| Right Wrist | 16 | Elbow angle endpoint, calibration check |
| Left Hip | 23 | Torso length reference, kipping detection |
| Right Hip | 24 | Torso length reference, kipping detection |

**Post-calibration visibility check** (key landmarks): **shoulders and hips only** (indices 11, 12, 23, 24) — must have **visibility ≥ 0.6**. Elbows are excluded because they go above/behind the bar during pull-ups, reducing their visibility.

---

## 2. Pre-Detection Guards

1. **Landmark plausibility** (`areLandmarksPlausible`): Core landmarks (shoulders + hips) must form a plausible body — bounding box < 60% of frame, not collapsed.
2. **Minimum landmarks**: At least 25 landmarks must be present.

---

## 3. Calibration Phase

### Goal
Detect a valid **dead-hang position** and hold it for **90 consecutive frames** (~3 seconds at 30 fps). If a body profile already exists for pull-ups, calibration completes in half the frames (~45).

### Validation Criteria

1. **Body spread**: Shoulder-hip vertical distance > 0.08 (`MIN_SHOULDER_HIP_SPREAD`).
2. **Wrists above shoulders**: `midWristY - midShoulderY < 0.15` (hands on bar above head).
3. **Arms extended**: Smoothed elbow angle > 120° (`ELBOW_CONFIRM_DOWN`).

### Calibration Data Capture & Finalization

Uses **median** of captured frames to compute:
- `calibratedMinShoulderHipSpread` = median spread × 0.3
- `calibratedWristAboveShoulderMargin` = median wrist offset + 0.25
- `calibratedBaselineShoulderY` = median shoulder Y (dead-hang baseline)
- `calibratedTorsoLength` = median shoulder-hip spread (normalization reference)
- **Body profile ratios**: arm-to-torso ratio, natural arm extension

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
    ┌───▶│   down   │◀���─────────────┐
    │    └────┬─────┘               │
    │         │ rise ≥ RISE_UP      │
    │         │ AND elbow ≤ 100°    │
    │         ▼                     │
    │    ┌──────────┐               │
    │    │    up    │───────────────┘
    │    └──────────┘  rise ≤ 0.12
    │         │         AND elbow ≥ 120°
    │         │         → rep counted
    │    ┌──────────┐
    │    │transition│
    │    └──────────┘
    └───────────────────────────────┘
```

> **Note**: Unlike push-ups and squats, the pull-up starts in the **down** phase (dead hang) after calibration, and the rep is counted when reaching the **up** position (chin at/above bar).

### Phase Transitions

| From | To | Condition |
| ---- | -- | --------- |
| `idle` | `down` | Calibration complete |
| `down` | `up` | Rise fraction **≥ RISE_UP** (adaptive, default ~0.35) AND elbow angle **≤ 100°** |
| `down` → `up` | records rep | When both conditions met and `hasReachedValidDown` is true |
| `up`/`transition` | `down` | Rise fraction **≤ 0.12** AND elbow angle **≥ 120°** for **2 consecutive frames** (hysteresis) |

### Incomplete Rep Detection

If the user starts ascending (`wasDescending = true`, `maxRiseThisRep > 0.1`) but doesn't reach RISE_UP: *"Pull higher!"*.

---

## 5. Primary Signal — Shoulder Vertical Displacement

### Rise Fraction Computation

```
smoothedShoulderY = sliding window average (3 frames) of midShoulderY
rise = calibratedBaselineShoulderY - smoothedShoulderY  (positive when rising)
riseFraction = rise / calibratedTorsoLength             (normalized to body proportions)
```

### Rise Thresholds

| Constant | Value | Meaning |
| -------- | ----- | ------- |
| `RISE_UP` | adaptive (~0.35) | Chin likely at/above bar |
| `RISE_DOWN` | 0.12 | Nearly back at baseline |
| `perfectRiseFraction` | adaptive (~0.55) | Deep pull — chest to bar |

---

## 6. Secondary Signal — Elbow Angle

The elbow angle serves as a **confirmation gate** to prevent false positives from camera movement or body sway.

### Smoothing (two layers)

1. **One Euro Filter** (upstream): `min_cutoff=1.5, beta=0.5` applied to all landmarks.
2. **Visibility-weighted side selection + sliding window** (3 frames).

### Confirmation Thresholds

| Phase Transition | Rise Condition | Elbow Condition |
| ---------------- | -------------- | --------------- |
| down → up | rise ≥ RISE_UP | elbow **≤ 100°** (arms bent) |
| up → down | rise ≤ 0.12 | elbow **≥ 120°** (arms extending) |

Both conditions must be met simultaneously.

---

## 7. Scoring

Each rep receives a **total score** (0–100):

```
totalScore = 0.6 × amplitudeScore + 0.4 × alignmentScore
```

### 7.1 Amplitude Score

Based on **maxRiseThisRep** — the peak rise fraction during the rep:

| Height | Score |
| ------ | ----- |
| maxRise ≥ perfectRiseFraction | **100** |
| maxRise between RISE_UP and perfect | Linear interpolation **50 → 100** |
| maxRise ≤ RISE_UP | **50** (minimum if rep counted) |

### 7.2 Alignment Score

Combining three sub-scores:

#### Arm Symmetry (35%)

```
diff = |leftElbowAngle - rightElbowAngle|
armSymmetry = diff ≤ 20° ? 100 : max(0, 100 - ((diff - 20) / 30) × 100)
```

#### Body Sway (30%)

Horizontal displacement of shoulder midpoint from hip midpoint:

```
sway = |shoulderMidX - hipMidX|
swayScore = sway ≤ 0.04 ? 100 : max(0, 100 - ((sway - 0.04) / 0.08) × 100)
```

#### Kipping Penalty (35%)

Detects hip-driven momentum by tracking vertical hip velocity:

```
hipVelocity = |currentHipY - previousHipY|
kippingScore = vel ≤ 0.025 ? 100 : max(0, 100 - ((vel - 0.025) / 0.035) × 100)
```

---

## 8. Feedback System

| Priority | Condition | Feedback |
| -------- | --------- | -------- |
| 1 | amplitude ≥ 90 AND alignment ≥ 85 | `perfect` |
| 2 | amplitudeScore < 60 | `go_lower` (pull higher) |
| 3 | max hip velocity > 0.05 | `kipping` |
| 4 | worst body sway > 0.08 | `body_sway` |
| 5 | worst arm asymmetry > 40° | `arms_uneven` |
| 6 | rep duration < 1000ms | `too_fast` |
| 7 (default) | | `good` |

---

## 9. Anti-Cheat & Robustness

1. **One Euro Filter**: Upstream landmark smoothing eliminates jitter.
2. **Landmark Plausibility**: Rejects hallucinated/exploded skeletons.
3. **Bounding Box Lock**: After calibration, rejects poses drifting too far.
4. **Post-Calibration Visibility**: Shoulders and hips must have visibility ≥ 0.6 (elbows excluded — occluded during pull-ups).
5. **Down Phase Hysteresis**: 2 consecutive frames required before confirming down phase.
6. **Dual-Signal Gating**: Both shoulder rise AND elbow angle must agree for a phase transition.
7. **Median Calibration**: Robust against outlier frames.
8. **Kipping Detection**: Hip velocity monitoring actively penalizes momentum-based reps.
9. **Dynamic Calibration**: First 5 reps capture actual rise for adaptive threshold adjustment.

---

## 10. Key Differences from Other Detectors

| Aspect | Push-Up / Squat | Pull-Up |
| ------ | --------------- | ------- |
| Primary signal | Joint angle only | Shoulder vertical displacement |
| Secondary signal | None | Elbow angle (confirmation) |
| Calibration records | Adaptive thresholds | Baseline shoulder Y + torso length |
| Rep counted on | Return to UP | Reaching UP (chin at bar) |
| Starting phase | `up` (extended) | `down` (hanging) |
| Alignment includes | Symmetry + body line/knee tracking | Symmetry + sway + kipping |
| Key landmark visibility | Includes elbows | Excludes elbows (occluded) |

---

## 11. Grade Mapping

| Grade | Score Range |
| ----- | ----------- |
| **S** | ≥ 90 |
| **A** | ≥ 75 |
| **B** | ≥ 60 |
| **C** | ≥ 45 |
| **D** | < 45 |
