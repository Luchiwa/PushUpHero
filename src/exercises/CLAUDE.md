# Exercise Detection System

Reference for working on exercise detectors. Read this BEFORE modifying any detector.

## Pipeline

```
Camera frame
  -> usePoseDetection (MediaPipe PoseLandmarker, 30fps)
  -> LandmarkSmoother (One Euro Filter x/y/z + confidence interpolation)
  -> useExerciseDetector -> ConcreteDetector.processPose(landmarks)
  -> ExerciseState { repCount, currentPhase, isCalibrated, ... }
  -> Dashboard UI + PoseOverlay Worker (skeleton on OffscreenCanvas)
```

MediaPipe outputs 33 landmarks per frame. The `LandmarkSmoother` applies two layers of processing BEFORE landmarks reach the detector:
1. **Confidence interpolation**: Low-visibility landmarks (0.15–0.5) are blended toward their last-known-good position. Below 0.15, the position is frozen entirely (MediaPipe hallucinates at very low confidence). This prevents frame drops when joints flicker around the visibility threshold.
2. **One Euro Filter** on x/y/z coordinates (minCutoff=1.5, beta=0.5) — adaptive jitter removal.

Inside the detector, `smoothAngle()` applies a **second One Euro Filter** (minCutoff=2.0, beta=0.7) on the computed joint angle. This is adaptive — less lag during fast movements (phase transitions), more smoothing at rest. Unlike the old 3-frame sliding window, it **preserves angle peaks** with only ~1-2° clipping instead of ~5°.

## Detector Lifecycle

1. **Calibration** (~90 frames / 3s): User holds starting position. Detector collects morphological data (body proportions) and locks a bounding box.
2. **Post-calibration guards** (every frame): Bounding box check + KEY_LANDMARKS visibility check. If either fails, the frame is SKIPPED entirely (processPose returns early, phase machine does NOT run).
3. **Phase machine**: Detects up/down/transition phases from the smoothed angle. Counts reps at specific phase transitions.
4. **Scoring**: Each rep scored 0-100 (60% amplitude + 40% alignment).
5. **Dynamic calibration**: First 5 reps capture the user's natural movement range for adaptive thresholds on future sessions.

## Detector class hierarchy

Two base classes pick the contract you inherit:

- **`BaseExerciseDetector`** — owns calibration lifecycle, bbox lock, dynamic calibration, scoring helpers, and the `runFinalizeCalibration` template. Subclass it directly when your exercise needs a **custom phase machine** (`PullUpDetector`, `LegRaiseDetector`).
- **`AngleBasedExerciseDetector` extends `BaseExerciseDetector`** — adds `processAngleBasedPhase`, the standard "REST-counted" state machine. Subclass it when reps count at the return-to-rest (`PushUpDetector`, `SquatDetector`).

Choosing wrong leaks a method you can't use into your IDE. The hierarchy split is the contract — don't bypass it.

Each subclass MUST implement two `protected abstract` hooks (declared on `BaseExerciseDetector`):
- `getCalibrationFrames(): unknown[]` — return your typed `calibrationFrames` array (the cast back to your concrete frame type happens inside `captureCalibrationRatios`).
- `captureCalibrationRatios(med, landmarks)` — populate `calibratedXxx` fields and `_capturedRatios.<exerciseType>` from `med`. Cast `med` once at the top: `const med = medUntyped as (extractor: (f: Frame) => number) => number;` where `Frame = (typeof this.calibrationFrames)[number]`.

The base owns the `med` closure construction over your frames + the trailing `lockBoundingBox` call.

## CRITICAL: When Reps Are Counted

### `processAngleBasedPhase` (template method on AngleBasedExerciseDetector)

Counts reps when `smoothedAngle >= angleUp` (the REST/high-angle position). Flow:

```
DOWN phase (angle <= angleDown, 2 frames) -> latch hasReachedValidDown
  -> angle rises through transition
  -> UP phase (angle >= angleUp) -> REP COUNTED -> reset latch
```

**This means reps count at the REST position (high angle), NOT at the effort peak (low angle).**

- **Push-ups**: Correct. Rep counts when arms re-extend (top of push-up).
- **Squats**: Correct. Rep counts when standing back up.

### When to NOT use the template method

If the exercise should count at the PEAK (low angle) instead of REST (high angle), you MUST write a custom phase machine and `extends BaseExerciseDetector` directly (not `AngleBasedExerciseDetector`). The template method CANNOT be inverted by swapping thresholds.

- **Leg raises**: Custom inverted machine. Rep counts when legs are RAISED (low hip angle). Latch at REST (legs flat, high angle), count at PEAK (legs raised, low angle).
- **Pull-ups**: Custom dual-condition machine. Rep counts at TOP (high shoulder rise + bent elbows). Uses both shoulder Y displacement AND elbow angle.

### Rule of thumb for new exercises

Ask: "When does the user feel the rep is done?"
- If at the return to starting position -> `extends AngleBasedExerciseDetector` and call `this.processAngleBasedPhase(...)`
- If at the peak of effort -> `extends BaseExerciseDetector` and write a custom phase machine (see LegRaiseDetector as template)
- If it needs multiple signals -> `extends BaseExerciseDetector` and write a custom machine (see PullUpDetector as template)

## KEY_LANDMARKS: What to Include and Exclude

`checkPostCalibrationGuards` requires ALL listed landmarks to have visibility >= 0.6. If ANY key landmark drops below this, the **entire frame is skipped** and the phase machine does not run.

**NEVER include joints that move to extreme positions during the exercise.** They lose visibility at the exact moment detection matters most.

| Exercise   | KEY_LANDMARKS                    | Excluded & Why                                         |
|------------|----------------------------------|--------------------------------------------------------|
| Push-up    | Shoulders, Hips                  | Elbows: visibility drops when arms fully extended (UP) |
| Squat      | Hips, Knees, Ankles              | None needed: all stay visible during squat             |
| Pull-up    | Shoulders, Hips                  | Elbows: go above/behind bar, visibility drops          |
| Leg raise  | Hips only (vis >= 0.35)          | Everything else: lying pose = low confidence overall   |

For lying-down exercises (leg raises), MediaPipe produces much noisier, lower-confidence landmarks. Use custom post-calibration guards with a lower visibility threshold (0.35 instead of 0.6).

## Angle Thresholds

Default thresholds per exercise (from `bodyProfile.ts` get*Thresholds functions):

| Exercise   | angleUp (rest) | angleDown (work) | perfect | Joint measured            |
|------------|----------------|-------------------|---------|---------------------------|
| Push-up    | 150            | 130               | 80      | Shoulder->Elbow->Wrist    |
| Squat      | 160            | 110               | 80      | Hip->Knee->Ankle          |
| Pull-up    | rise 0.35      | rise 0.12         | 0.55    | Shoulder Y rise fraction  |
| Leg raise  | 155            | 110               | 85      | Shoulder->Hip->Ankle      |

**Hysteresis gap** (angleUp - angleDown) must be >= 20 degrees to prevent oscillation with the 3-frame smoothing. If the gap is too small, the smoothed angle can bounce between phases.

**angleUp must account for smoothing lag.** With the adaptive One Euro Filter, the smoothed angle peaks ~1-2 degrees below the actual peak (improved from ~5° with the old sliding window). If angleUp is set too high (e.g., 158 for push-ups where actual peak is 160), the smoothed peak may not trigger the UP phase. The rep then counts late on the next cycle, giving the user the impression they "have to go back down."

## Calibration Design Per Pose Type

| Pose type     | MediaPipe quality | Visibility threshold | Calibration strictness |
|---------------|-------------------|----------------------|------------------------|
| Standing      | Excellent         | 0.5                  | Strict (squat)         |
| Plank/prone   | Good              | 0.5                  | Moderate (push-up)     |
| Hanging       | Good              | 0.5                  | Moderate (pull-up)     |
| Lying down    | Poor              | 0.25                 | Very lenient (leg raise)|

MediaPipe is trained on upright poses. Lying-down bodies are out-of-distribution: expect lower confidence, noisier positions, and potential landmark hallucinations. Compensate with generous thresholds everywhere.

## Scoring System

```
repScore = 0.6 * amplitudeScore + 0.4 * alignmentScore

amplitudeScore = linearScore(minAngle, angleDown, perfectAngle)
  - 100 at perfectAngle (deepest/highest)
  - 0 at angleDown (barely past threshold)

alignmentScore = exercise-specific (usually 2 sub-scores at 50/50)
```

Grade mapping: S >= 90, A >= 75, B >= 60, C >= 45, D < 45.

## Adding a New Exercise (Checklist)

1. **Decide phase machine type**: REST-counted (`extends AngleBasedExerciseDetector`) or PEAK-counted (`extends BaseExerciseDetector` + custom machine)?
2. **Create detector** in `exercises/<name>/<Name>Detector.ts`:
   - Choose landmarks and joint angle
   - Define calibration criteria (what position? how strict?)
   - Pick KEY_LANDMARKS (exclude joints that move to extremes)
   - Set angle thresholds (mind the smoothing lag and hysteresis gap)
   - Implement scoring (amplitude + alignment)
   - Map feedback types
   - **Implement the abstracts**: `getCalibrationFrames()` returns `this.calibrationFrames`; `captureCalibrationRatios(med, landmarks)` populates `_capturedRatios.<exerciseType>` + any `calibratedXxx` fields. Cast `med` to your typed `Frame` once at the top.
   - **Trigger finalisation**: when `calibrationFrameCount` reaches the threshold, call `this.runFinalizeCalibration(landmarks)` (do not write your own `finalizeCalibration` method — the base owns that template).
3. **Update types.ts**: Add to `ExerciseType`, `EXERCISE_TYPES`, `EXERCISE_META`, and new `RepFeedback` values
4. **Update bodyProfile.ts**: Add profile interface + threshold function (with safe defaults)
5. **Update BaseExerciseDetector.ts**: Add to `CapturedRatios` interface
6. **Update exerciseDifficulty.ts**: Add difficulty coefficient
7. **Update registry.ts**: Add to `EXERCISE_REGISTRY` + `BODY_PROFILE_MERGE`
8. **Update coachEngine.ts**: Add spoken phrases for new RepFeedback values
9. **Optionally update quests.ts**: Add exercise-specific quests
10. **Build + lint**: `npm run build && npm run lint`

Auto-included (no changes needed): achievements, stats screen, exercise picker, summary screen, XP system, pose overlay worker (key joints sent dynamically).

## Common Bugs and How to Avoid Them

**"Rep counts on the wrong phase"**: You used `processAngleBasedPhase` for an exercise that should count at the peak. Write a custom phase machine instead.

**"Rep requires going back down to count"**: Either (a) angleUp threshold is too high for the smoothed signal to reach, or (b) KEY_LANDMARKS include a joint that loses visibility at the UP position, causing frames to be skipped at the peak. Lower the threshold and/or remove the problematic landmark from KEY_LANDMARKS.

**"Calibration never completes"**: Thresholds too strict for the camera angle / pose type / MediaPipe confidence level. Relax visibility requirements and positional constraints.

**"Grades are random / never S"**: Adaptive thresholds from body profile are producing bad values (NaN, too strict). Ensure `get*Thresholds()` returns safe defaults when profile data is missing or invalid. Currently, all detectors call threshold functions with NO arguments in constructor and reset() to force defaults.

**"Detection works for some people but not others"**: The angleUp threshold is too close to some users' natural extension. Lower it by 3-5 degrees. The adaptive One Euro smoothing clips the peak by ~1-2 degrees.
