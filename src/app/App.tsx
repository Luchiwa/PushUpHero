/**
 * App — Root component. Wires camera, pose detection, and renders
 * the current screen. All workout logic lives in useWorkoutStateMachine.
 */
import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useCamera } from '@hooks/useCamera';
import type { FacingMode } from '@hooks/useCamera';
import { usePoseDetection } from '@hooks/usePoseDetection';
import { useExerciseDetector } from '@hooks/useExerciseDetector';
import { PushUpDetector } from '@exercises/pushup/PushUpDetector';
import { SquatDetector } from '@exercises/squat/SquatDetector';
import { PullUpDetector } from '@exercises/pullup/PullUpDetector';
import type { ExerciseType } from '@exercises/types';
import { useWorkoutStateMachine, durationToSeconds } from './useWorkoutStateMachine';
import { totalXpForLevel } from '@lib/xpSystem';
import { StartScreen } from '@screens/StartScreen/StartScreen';
import { WorkoutConfigScreen } from '@screens/WorkoutConfigScreen/WorkoutConfigScreen';
import { RestScreen } from '@screens/RestScreen/RestScreen';
import { SummaryScreen } from '@screens/SummaryScreen/SummaryScreen';
import { LevelUpScreen } from '@screens/LevelUpScreen/LevelUpScreen';
import { Dashboard } from '@overlays/Dashboard/Dashboard';
import { PoseOverlay } from '@components/PoseOverlay/PoseOverlay';
import type { PoseOverlayHandle } from '@components/PoseOverlay/PoseOverlay';
import { PositionGuide } from '@components/PositionGuide/PositionGuide';
import { ReloadPrompt } from '@components/ReloadPrompt/ReloadPrompt';
import { getExerciseLabel } from '@exercises/types';
import { useInGameAchievements } from '@hooks/useInGameAchievements';
import { AchievementToast } from '@components/AchievementToast/AchievementToast';
import './App.scss';

function App() {
  const [facingMode, setFacingMode] = useState<FacingMode>('user');
  const [exerciseType, setExerciseType] = useState<ExerciseType>('pushup');
  const detector = useMemo(() => {
    switch (exerciseType) {
      case 'squat':  return new SquatDetector();
      case 'pullup': return new PullUpDetector();
      default:       return new PushUpDetector();
    }
  }, [exerciseType]);

  // ── Exercise detector ────────────────────────────────────────────
  const [isActive, setIsActive] = useState(false);
  const { exerciseState, processLandmarks, resetDetector } = useExerciseDetector({
    detector,
    isActive,
  });

  // ── Camera ───────────────────────────────────────────────────────
  const { videoRef, isReady: isCameraReady, error: cameraError, triggerStart: startCamera } =
    useCamera({ facingMode, enabled: isActive });

  // ── Workout state machine ────────────────────────────────────────
  const handleExerciseTypeChange = useCallback((type: ExerciseType) => {
    setExerciseType(type);
  }, []);

  const wm = useWorkoutStateMachine({
    exerciseState,
    resetDetector,
    startCamera,
    onExerciseTypeChange: handleExerciseTypeChange,
  });

  // Sync isActive from state machine screen
  useEffect(() => { setIsActive(wm.screen === 'active'); }, [wm.screen]);

  // ── In-game achievements ─────────────────────────────────────────
  const { achievementQueue, dismissFirst, shownIdsRef: inGameShownRef } = useInGameAchievements({
    exerciseType,
    exerciseState,
    completedSetsReps: wm.completedSetsReps,
    isActive: wm.screen === 'active',
    soundEnabled: wm.soundEnabled,
  });

  // ── Pose detection ───────────────────────────────────────────────
  const poseOverlayRef = useRef<PoseOverlayHandle>(null);
  const exerciseStateRef = useRef(exerciseState);
  useEffect(() => { exerciseStateRef.current = exerciseState; }, [exerciseState]);

  const { isModelReady, modelError } = usePoseDetection({
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
          <PoseOverlay ref={poseOverlayRef} videoRef={videoRef} exerciseType={exerciseType} />
          <PositionGuide
            exerciseType={exerciseType}
            isCalibrated={exerciseState.isCalibrated}
            calibratingPercentage={exerciseState.calibratingPercentage}
          />
          <Dashboard
            exerciseType={exerciseType}
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
            currentSet={wm.flatSetIndex + 1}
            totalSets={wm.totalSetsAllBlocks}
            currentBlock={wm.isMultiExercise ? wm.currentBlockIndex + 1 : undefined}
            totalBlocks={wm.isMultiExercise ? wm.totalBlocks : undefined}
          />
          {/* In-game achievement toast */}
          {achievementQueue.length > 0 && (
            <AchievementToast
              key={achievementQueue[0].id}
              achievement={achievementQueue[0]}
              onDone={dismissFirst}
            />
          )}
        </>
      )}

      {wm.screen === 'idle' && (
        <StartScreen
          isModelReady={isModelReady}
          cameraError={modelError ?? cameraError}
          exerciseType={exerciseType}
          onExerciseTypeChange={(t) => {
            setExerciseType(t);
            wm.setWorkoutPlan(prev => ({
              blocks: prev.blocks.map((b, i) => i === 0 ? { ...b, exerciseType: t } : b),
            }));
          }}
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
          plan={wm.workoutPlan}
          onPlanChange={wm.setWorkoutPlan}
          onStart={wm.handleWorkoutStart}
          onBack={wm.handleBackToIdle}
          isReady={isModelReady}
        />
      )}

      {wm.screen === 'rest' && wm.completedSets.length > 0 && (
        <RestScreen
          restDuration={durationToSeconds(wm.currentBlock.restBetweenSets)}
          completedSet={wm.currentSetIndex + 1}
          totalSets={wm.totalSetsInBlock}
          lastSetResult={wm.completedSets[wm.completedSets.length - 1]}
          onRestComplete={wm.handleRestComplete}
          exerciseLabel={getExerciseLabel(wm.currentBlock.exerciseType)}
        />
      )}

      {wm.screen === 'exercise-rest' && wm.completedSets.length > 0 && (
        <RestScreen
          restDuration={durationToSeconds(wm.currentBlock.restAfterBlock)}
          completedSet={wm.currentBlockIndex + 1}
          totalSets={wm.totalBlocks}
          lastSetResult={wm.completedSets[wm.completedSets.length - 1]}
          onRestComplete={wm.handleExerciseRestComplete}
          exerciseLabel={getExerciseLabel(wm.currentBlock.exerciseType)}
          isExerciseTransition
          nextExerciseLabel={
            wm.currentBlockIndex + 1 < wm.totalBlocks
              ? getExerciseLabel(wm.workoutPlan.blocks[wm.currentBlockIndex + 1].exerciseType)
              : undefined
          }
        />
      )}

      {wm.screen === 'stopped' && (
        <SummaryScreen
          exerciseType={exerciseType}
          exerciseState={exerciseState}
          completedSets={wm.completedSets}
          workoutPlan={wm.isMultiExercise ? wm.workoutPlan : undefined}
          onReset={wm.handleReset}
          sessionMode={wm.sessionMode}
          elapsedTime={wm.elapsedTime}
          sessionXp={wm.lastSessionXp ?? undefined}
          soundEnabled={wm.soundEnabled}
          goalReached={wm.goalReached}
          newAchievements={
            wm.lastSessionXp?.newAchievements?.filter(
              a => !inGameShownRef.current.has(a.id),
            )
          }
          brokenRecords={wm.lastSessionXp?.brokenRecords}
        />
      )}

      {wm.screen === 'levelup' && (
        <LevelUpScreen
          previousLevel={wm.levelBefore}
          newLevel={wm.savedLevel ?? wm.liveLevel}
          onContinue={wm.handleLevelUpContinue}
          xpEarned={wm.lastSessionXp?.totalXp}
          xpToNextLevel={
            totalXpForLevel((wm.savedLevel ?? wm.liveLevel) + 1)
            - totalXpForLevel(wm.savedLevel ?? wm.liveLevel)
          }
        />
      )}

      <ReloadPrompt />
    </div>
  );
}

export default App;
