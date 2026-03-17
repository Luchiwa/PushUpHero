/**
 * App — Root component. Wires camera, pose detection, and renders
 * the current screen. All workout logic lives in useWorkoutStateMachine.
 */
import { useMemo, useState, useRef, useEffect } from 'react';
import { useCamera } from '@hooks/useCamera';
import type { FacingMode } from '@hooks/useCamera';
import { usePoseDetection } from '@hooks/usePoseDetection';
import { useExerciseDetector } from '@hooks/useExerciseDetector';
import { PushUpDetector } from '@exercises/pushup/PushUpDetector';
import { useWorkoutStateMachine } from './useWorkoutStateMachine';
import { StartScreen } from '@screens/StartScreen/StartScreen';
import { WorkoutConfigScreen } from '@screens/WorkoutConfigScreen/WorkoutConfigScreen';
import { RestScreen } from '@screens/RestScreen/RestScreen';
import { SummaryScreen } from '@screens/SummaryScreen/SummaryScreen';
import { LevelUpScreen } from '@screens/LevelUpScreen/LevelUpScreen';
import { Dashboard } from '@overlays/Dashboard/Dashboard';
import { VictoryOverlay } from '@overlays/VictoryOverlay/VictoryOverlay';
import { PoseOverlay } from '@components/PoseOverlay/PoseOverlay';
import type { PoseOverlayHandle } from '@components/PoseOverlay/PoseOverlay';
import { PositionGuide } from '@components/PositionGuide/PositionGuide';
import { ReloadPrompt } from '@components/ReloadPrompt/ReloadPrompt';
import './App.scss';

function App() {
  const [facingMode, setFacingMode] = useState<FacingMode>('user');
  const detector = useMemo(() => new PushUpDetector(), []);

  // ── Exercise detector ────────────────────────────────────────────
  // isActive is synced from wm.screen via useEffect (one render behind).
  // processLandmarks uses a ref internally so the guard is always current.
  const [isActive, setIsActive] = useState(false);
  const { exerciseState, processLandmarks, resetDetector } = useExerciseDetector({
    detector,
    isActive,
  });

  // ── Camera ───────────────────────────────────────────────────────
  const { videoRef, isReady: isCameraReady, error: cameraError, triggerStart: startCamera } =
    useCamera({ facingMode, enabled: isActive });

  // ── Workout state machine ────────────────────────────────────────
  const wm = useWorkoutStateMachine({
    exerciseState,
    resetDetector,
    startCamera,
  });

  // Sync isActive from state machine screen — intentional cascading render
  // on (rare) screen transitions; ref-based isActive in the detector ensures
  // processLandmarks always reads the latest value.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setIsActive(wm.screen === 'active'); }, [wm.screen]);

  // ── Pose detection ───────────────────────────────────────────────
  const poseOverlayRef = useRef<PoseOverlayHandle>(null);
  const exerciseStateRef = useRef(exerciseState);
  useEffect(() => { exerciseStateRef.current = exerciseState; }, [exerciseState]);

  const { isModelReady } = usePoseDetection({
    videoRef,
    isVideoReady: isCameraReady,
    isActive: wm.screen === 'active',
    onFrame: (landmarks, rawResult) => {
      processLandmarks(landmarks);
      poseOverlayRef.current?.drawResult(
        rawResult,
        exerciseStateRef.current.currentPhase,
        exerciseStateRef.current.isValidPosition,
      );
    },
  });

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="app-container">
      <video
        ref={videoRef}
        className={`video-fullscreen ${wm.screen !== 'active' ? 'video-hidden' : ''} ${facingMode === 'environment' ? 'video-no-mirror' : ''}`}
        muted
        playsInline
      />

      {wm.screen === 'active' && (
        <>
          <PoseOverlay ref={poseOverlayRef} videoRef={videoRef} />
          <PositionGuide
            isCalibrated={exerciseState.isCalibrated}
            calibratingPercentage={exerciseState.calibratingPercentage}
          />
          <Dashboard
            exerciseState={exerciseState}
            goalReps={wm.goalReps}
            sessionMode={wm.sessionMode}
            timeGoal={wm.timeGoal}
            onStop={wm.handleStop}
            onTimerEnd={wm.handleTimerEnd}
            elapsedTimeRef={wm.elapsedTimeRef}
            onFlipCamera={() => {
              const newMode = facingMode === 'user' ? 'environment' : 'user';
              setFacingMode(newMode);
              startCamera(newMode);
            }}
            facingMode={facingMode}
            soundEnabled={wm.soundEnabled}
            onSoundToggle={() => wm.setSoundEnabled(s => !s)}
            level={wm.liveLevel}
            levelProgressPct={wm.liveProgressPct}
            currentSet={wm.currentSetIndex + 1}
            totalSets={wm.totalSets}
          />
        </>
      )}

      {wm.screen === 'idle' && (
        <StartScreen
          isModelReady={isModelReady}
          cameraError={cameraError}
          goalReps={wm.goalReps}
          onGoalChange={wm.setGoalReps}
          sessionMode={wm.sessionMode}
          onSessionModeChange={wm.setSessionMode}
          timeGoal={wm.timeGoal}
          onTimeGoalChange={wm.setTimeGoal}
          onStart={wm.handleStart}
          onOpenWorkoutConfig={wm.handleOpenConfig}
        />
      )}

      {wm.screen === 'config' && (
        <WorkoutConfigScreen
          config={wm.workoutConfig}
          onConfigChange={wm.setWorkoutConfig}
          onStart={wm.handleWorkoutStart}
          onBack={wm.handleBackToIdle}
          isReady={isModelReady}
        />
      )}

      {wm.screen === 'rest' && wm.completedSets.length > 0 && (
        <RestScreen
          restDuration={wm.workoutConfig.restTime.minutes * 60 + wm.workoutConfig.restTime.seconds}
          completedSet={wm.currentSetIndex + 1}
          totalSets={wm.totalSets}
          lastSetResult={wm.completedSets[wm.completedSets.length - 1]}
          onRestComplete={wm.handleRestComplete}
        />
      )}

      {wm.screen === 'stopped' && (
        <SummaryScreen
          exerciseState={exerciseState}
          completedSets={wm.completedSets}
          onReset={wm.handleReset}
          sessionMode={wm.sessionMode}
          elapsedTime={wm.elapsedTime}
        />
      )}

      {wm.screen === 'levelup' && (
        <LevelUpScreen
          previousLevel={wm.levelBefore}
          newLevel={wm.liveLevel}
          onContinue={wm.handleLevelUpContinue}
        />
      )}

      {wm.screen === 'victory' && (
        <VictoryOverlay
          repCount={wm.completedSetsReps}
          soundEnabled={wm.soundEnabled}
          onComplete={wm.handleVictoryComplete}
          sessionMode={wm.sessionMode}
          elapsedTime={wm.elapsedTime}
          totalSets={wm.totalSets}
        />
      )}

      <ReloadPrompt />
    </div>
  );
}

export default App;
