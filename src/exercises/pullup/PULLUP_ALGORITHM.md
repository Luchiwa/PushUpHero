# Pull-Up Detector — Algorithm Documentation

## Overview

The Pull-Up Detector uses a **dual-signal approach** combining **shoulder vertical displacement** (primary) with **elbow angle confirmation** (secondary). Unlike push-ups and squats which rely solely on joint angles, pull-ups require tracking how much the body rises relative to a calibrated dead-hang baseline. This is necessary because the camera typically captures only the upper body during pull-ups, making pure angle-based detection unreliable.

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

All landmarks must have a **visibility score ≥ 0.4** to be processed.

---

## 2. Calibration Phase

### Goal
Detect a valid **dead-hang position** and hold it for **90 consecutive frames** (~3 seconds at 30 fps). During calibration, two critical baseline values are recorded:

- **`calibratedBaselineShoulderY`**: The average shoulder Y position at dead hang (lowest point)
- **`calibratedTorsoLength`**: The distance between shoulder midpoint and hip midpoint (used as normalization reference)

### Validation Criteria

1. **Landmarks visible**: All 8 required landmarks pass the visibility threshold.
2. **Arms extended**: Smoothed elbow angle **≥ 150°** — arms are straight, hanging from the bar.
3. **Wrists above shoulders**: Average wrist Y **< average shoulder Y** (in screen coordinates where Y increases downward). This confirms the user is hanging from a bar above them.
4. **Body spread**: The vertical distance between shoulder midpoint and hip midpoint exceeds **10%** of the frame height, ensuring the full upper body is visible.

### Baseline Recording

During each valid calibration frame, the detector accumulates:
- Sum of shoulder Y positions → averaged to produce `calibratedBaselineShoulderY`
- Sum of torso lengths → averaged to produce `calibratedTorsoLength`

### Calibration Coaching

Vocal guidance every 8 seconds:
- *"Hang from the bar with arms fully extended"*
- *"Make sure your upper body is visible"*
- *"Hold steady, almost there"*

---

## 3. State Machine

```
         ┌──────────┐
         │   idle   │  (before calibration)
         └────┬─────┘
              │ calibration complete
              ▼
         ┌──────────┐
    ┌───▶│   down   │◀──────────────┐
    │    └────┬─────┘               │
    │         │ rise ≥ RISE_UP      │
    │         │ AND elbow ≤ 90°     │
    │         ▼                     │
    │    ┌──────────┐               │
    │    │    up    │───────────────┘
    │    └──────────┘  rise ≤ RISE_DOWN
    │                   AND elbow ≥ 120°
    │                   → rep counted
    └───────────────────────────────┘
```

> **Note**: Unlike push-ups and squats, the pull-up starts in the **down** phase (dead hang) after calibration, and the rep is counted on the **descent** (returning to hang after pulling up).

### Phase Transitions

| From | To | Condition |
| ---- | -- | --------- |
| `idle` | `down` | Calibration complete |
| `down` | `up` | Rise fraction **≥ 0.35** AND elbow angle **≤ 90°** |
| `up` | `down` | Rise fraction **≤ 0.12** AND elbow angle **≥ 120°** → **rep recorded** |

---

## 4. Primary Signal — Shoulder Vertical Displacement

### Rise Fraction Computation

Each frame, the detector calculates how much the shoulders have risen from the calibrated dead-hang baseline:

```
currentShoulderY = (leftShoulder.y + rightShoulder.y) / 2
rise = calibratedBaselineShoulderY - currentShoulderY     // positive when rising (Y decreases upward)
riseFraction = rise / calibratedTorsoLength               // normalized to body proportions
```

The **rise fraction** represents how many "torso lengths" the shoulders have risen. This normalization makes the detector work regardless of the user's distance from the camera.

### Rise Thresholds

| Constant | Value | Meaning |
| -------- | ----- | ------- |
| `RISE_UP` | 0.35 | Shoulders rose ≥ 35% of torso length — chin likely at/above bar |
| `RISE_DOWN` | 0.12 | Shoulders nearly back at baseline — full descent |
| `PERFECT_RISE` | 0.55 | Shoulders rose ≥ 55% of torso length — deep pull, chest to bar |

### Smoothing

The rise fraction is smoothed using EMA:

```
smoothedRise = α × rawRise + (1 - α) × previousSmoothedRise
```

where **α = 0.35** (SMOOTHING_FACTOR).

---

## 5. Secondary Signal — Elbow Angle

The elbow angle serves as a **confirmation gate** to prevent false positives from camera movement or body sway.

```
angle = computeAngle(shoulder, elbow, wrist)
```

Smoothed with the same EMA (α = 0.35).

### Confirmation Thresholds

| Phase Transition | Rise Condition | Elbow Condition |
| ---------------- | -------------- | --------------- |
| down → up | rise ≥ 0.35 | elbow **≤ 90°** (arms bent) |
| up → down | rise ≤ 0.12 | elbow **≥ 120°** (arms extending) |

Both conditions must be met simultaneously for a phase transition.

---

## 6. Scoring

Each rep receives a **total score** (0–100):

```
totalScore = 0.5 × amplitudeScore + 0.5 × alignmentScore
```

### 6.1 Amplitude Score

Based on **`maxRiseThisRep`** — the peak rise fraction recorded during the rep:

| Height | Score |
| ------ | ----- |
| maxRise ≥ PERFECT_RISE (0.55) | **100** |
| maxRise between RISE_UP and PERFECT | Linear interpolation 50 → 100 |
| maxRise ≤ RISE_UP (0.35) | **50** (minimum if rep counted) |

```
amplitudeScore = 50 + 50 × (maxRise - RISE_UP) / (PERFECT_RISE - RISE_UP)
```

### 6.2 Alignment Score

Evaluated at the moment the rep is recorded, combining three sub-scores:

#### Arm Symmetry (35%)

Compares left and right elbow angles:

```
diff = |leftElbowAngle - rightElbowAngle|
armSymmetry = max(0, 100 - diff × 5)
```

#### Body Sway (30%)

Measures horizontal displacement of shoulder midpoint from its position at the start of the rep. Penalizes lateral swinging:

```
sway = |currentShoulderX - baselineShoulderX|
swayScore = max(0, 100 - sway × 500)
```

A lateral sway of 0.2 (in normalized coordinates) results in a score of 0.

#### Kipping Penalty (35%)

Detects hip-driven momentum (kipping) by measuring the vertical velocity of the hip midpoint:

```
hipVelocity = |currentHipY - previousHipY|
kippingScore = max(0, 100 - hipVelocity × 2000)
```

High hip velocity indicates the user is using a swinging motion rather than strict pulling.

---

## 7. Feedback System

After each rep, feedback is selected by priority:

| Priority | Condition | Example Feedback |
| -------- | --------- | ---------------- |
| 1 (highest) | amplitudeScore < 60 | *"Pull higher!"* or *"Chin over the bar!"* |
| 2 | kippingScore < 60 | *"No kipping!"* or *"Strict pull-up!"* |
| 3 | swayScore < 60 | *"Stay steady!"* or *"Control the swing!"* |
| 4 | armSymmetry < 70 | *"Even arms!"* or *"Balance both sides!"* |
| 5 | rep took > 5s | *"Pick up the pace!"* |
| 6 | totalScore ≥ 90 | *"Perfect form!"* |
| 7 (default) | totalScore ≥ 60 | *"Good rep!"* |

### Incomplete Rep Feedback

If the user starts ascending (`wasAscending = true`, rise > 0.1) but doesn't reach the RISE_UP threshold (0.35):
- *"Pull higher!"*, *"Get your chin over the bar!"*, *"Don't stop halfway!"*, *"Complete the rep!"*

---

## 8. Anti-Cheat Measures

1. **Landmark Visibility**: All 8 landmarks must have visibility ≥ 0.4. Occluded frames are skipped.
2. **Dual-Signal Gating**: Both shoulder rise AND elbow angle must agree for a phase transition. Camera shake alone (which moves shoulders but doesn't bend elbows) won't trigger false reps.
3. **Dead-Hang Calibration**: Baseline is recorded from an actual hanging position, preventing standing users from gaming the system.
4. **Wrist-Above-Shoulder Check**: Confirms the user is hanging from a bar during calibration.
5. **Kipping Detection**: Hip velocity monitoring actively penalizes momentum-based reps.
6. **Rise Hysteresis**: UP (0.35) and DOWN (0.12) thresholds have a significant gap to prevent oscillation.
7. **Smoothing Filter**: EMA with α=0.35 filters out tracking noise.

---

## 9. Key Differences from Other Detectors

| Aspect | Push-Up / Squat | Pull-Up |
| ------ | --------------- | ------- |
| Primary signal | Joint angle only | Shoulder vertical displacement |
| Secondary signal | None | Elbow angle (confirmation) |
| Calibration records | Nothing (just validates pose) | Baseline shoulder Y + torso length |
| Rep counted on | Return to starting position | Return to dead hang (descent) |
| Starting phase | `up` (extended) | `down` (hanging) |
| Alignment includes | Symmetry + body line | Symmetry + sway + kipping |

---

## 10. Grade Mapping

| Grade | Score Range |
| ----- | ----------- |
| **S** | ≥ 90 |
| **A** | ≥ 75 |
| **B** | ≥ 60 |
| **C** | ≥ 45 |
| **D** | < 45 |
