/**
 * App — Root component. Wires camera, pose detection, and renders
 * the current screen. All workout logic lives in useWorkoutStateMachine.
 */
import { useMemo, useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import { useCamera } from '@hooks/useCamera';
import type { FacingMode } from '@hooks/useCamera';
import { usePoseDetection } from '@hooks/usePoseDetection';
import { useExerciseDetector } from '@hooks/useExerciseDetector';
import { useLevel, useAuthCore } from '@hooks/useAuth';
import type { ExerciseType } from '@exercises/types';
import { EXERCISE_REGISTRY } from '@exercises/registry';
import { useWorkoutStateMachine, durationToSeconds } from './useWorkoutStateMachine';
import { WorkoutContext } from './WorkoutContext';
import type { WorkoutContextType } from './WorkoutContext';
import { ExerciseStateContext } from './ExerciseStateContext';
import { totalXpForLevel } from '@domain/xpSystem';
import { StartScreen } from '@screens/StartScreen/StartScreen';
import { AppLoader } from '@components/AppLoader/AppLoader';
import { Dashboard } from '@overlays/Dashboard/Dashboard';

// Lazy-loaded screens (only parsed when their state is active)
const WorkoutConfigScreen = lazy(() => import('@screens/WorkoutConfigScreen/WorkoutConfigScreen').then(m => ({ default: m.WorkoutConfigScreen })));
const RestScreen = lazy(() => import('@screens/RestScreen/RestScreen').then(m => ({ default: m.RestScreen })));
const SummaryScreen = lazy(() => import('@screens/SummaryScreen/SummaryScreen').then(m => ({ default: m.SummaryScreen })));
const LevelUpScreen = lazy(() => import('@screens/LevelUpScreen/LevelUpScreen').then(m => ({ default: m.LevelUpScreen })));
import { PoseOverlay } from '@components/PoseOverlay/PoseOverlay';
import type { PoseOverlayHandle } from '@components/PoseOverlay/PoseOverlay';
import { PositionGuide } from '@components/PositionGuide/PositionGuide';
import { ReloadPrompt } from '@components/ReloadPrompt/ReloadPrompt';
import { ErrorBoundary } from '@components/ErrorBoundary/ErrorBoundary';
import { getExerciseLabel } from '@exercises/types';
import { useInGameAchievements } from '@hooks/useInGameAchievements';
import { useBodyProfile } from '@hooks/useBodyProfile';
import { useQuestProgress } from '@hooks/useQuestProgress';
import { getActiveQuest, getFeaturedQuest, getAvailableQuests, isQuestAccepted } from '@domain/quests';
import { AchievementToast } from '@components/AchievementToast/AchievementToast';
import './App.scss';

function App() {
  const [facingMode, setFacingMode] = useState<FacingMode>('user');
  const [exerciseType, setExerciseType] = useState<ExerciseType>('pushup');
  const detector = useMemo(() => EXERCISE_REGISTRY[exerciseType].createDetector(), [exerciseType]);

  // ── Exercise detector ────────────────────────────────────────────
  const [isActive, setIsActive] = useState(false);
  const { bodyProfile, saveBodyProfile } = useBodyProfile();
  const { questProgress, completeQuests, acceptQuest, abandonQuest, addProgress } = useQuestProgress();
  const { level: userLevel } = useLevel();
  const { user, loading: authLoading } = useAuthCore();
  const activeQuest = getActiveQuest(questProgress, userLevel);
  const featuredQuest = getFeaturedQuest(questProgress, userLevel);
  const availableQuests = getAvailableQuests(questProgress, userLevel);
  const acceptedQuests = availableQuests.filter(q => isQuestAccepted(q, questProgress));

  // ── Pending signup prompt (guest quest completion) ──────────────
  const [pendingSignupPrompt, setPendingSignupPrompt] = useState(false);

  const { exerciseState, processLandmarks, resetDetector, getCapturedRatios } = useExerciseDetector({
    detector,
    isActive,
    bodyProfile,
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
    activeQuest,
    availableQuests: acceptedQuests,
    questProgress,
    bodyProfile,
    onSaveBodyProfile: saveBodyProfile,
    onCompleteQuests: completeQuests,
    onAddProgress: addProgress,
    getCapturedRatios,
  });

  // ── Combined exercise type setter (for WorkoutContext) ──────────
  const { setWorkoutPlan } = wm;
  const changeExerciseType = useCallback((type: ExerciseType) => {
    setExerciseType(type);
    setWorkoutPlan(prev => ({
      blocks: prev.blocks.map((b, i) => i === 0 ? { ...b, exerciseType: type } : b),
    }));
  }, [setWorkoutPlan]);

  // ── WorkoutContext value ───────────────────────────────────────────
  // exerciseState is served via a separate ExerciseStateContext (30fps
  // consumers), so this memo only changes on slow-path transitions.
  const workoutCtx: WorkoutContextType = useMemo(() => ({
    ...wm,
    exerciseType,
    changeExerciseType,
  }), [wm, exerciseType, changeExerciseType]);

  // Sync isActive from state machine screen (derived state during render)
  const [prevWmScreen, setPrevWmScreen] = useState(wm.screen);
  if (wm.screen !== prevWmScreen) {
    setPrevWmScreen(wm.screen);
    setIsActive(wm.screen === 'active');

    // Detect transition from summary/levelup → idle for guest quest signup prompt
    if (
      (prevWmScreen === 'stopped' || prevWmScreen === 'levelup') &&
      wm.screen === 'idle' &&
      !user &&
      wm.questCompletedThisSession.length > 0
    ) {
      setPendingSignupPrompt(true);
    }
  }

  // ── In-game achievements ─────────────────────────────────────────
  const { achievementQueue, dismissFirst, shownIds: inGameShownIds } = useInGameAchievements({
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
    <WorkoutContext.Provider value={workoutCtx}>
    <ExerciseStateContext.Provider value={exerciseState}>
    <div className="app-container">
      <video
        ref={videoRef}
        className={`video-fullscreen ${wm.screen !== 'active' ? 'video-hidden' : ''} ${facingMode === 'environment' ? 'video-no-mirror' : ''}`}
        muted
        playsInline
      />

      {wm.screen === 'active' && (
        <ErrorBoundary fallback="section">
          <PoseOverlay ref={poseOverlayRef} videoRef={videoRef} exerciseType={exerciseType} />
          <PositionGuide
            exerciseType={exerciseType}
            isCalibrated={exerciseState.isCalibrated}
            calibratingPercentage={exerciseState.calibratingPercentage}
          />
          <Dashboard
            facingMode={facingMode}
            onFlipCamera={() => {
              const newMode = facingMode === 'user' ? 'environment' : 'user';
              setFacingMode(newMode);
              startCamera(newMode);
            }}
          />
          {/* In-game achievement toast */}
          {achievementQueue.length > 0 && (
            <AchievementToast
              key={achievementQueue[0].id}
              achievement={achievementQueue[0]}
              onDone={dismissFirst}
            />
          )}
        </ErrorBoundary>
      )}

      {wm.screen === 'idle' && (
        authLoading
          ? <AppLoader />
          : (
            <ErrorBoundary fallback="section">
              <StartScreen
                isModelReady={isModelReady}
                cameraError={modelError ?? cameraError}
                featuredQuest={featuredQuest}
                activeQuest={activeQuest}
                questProgress={questProgress}
                userLevel={userLevel}
                onAcceptQuest={acceptQuest}
                onAbandonQuest={abandonQuest}
                pendingSignupPrompt={pendingSignupPrompt}
                onSignupPromptHandled={() => setPendingSignupPrompt(false)}
              />
            </ErrorBoundary>
          )
      )}

      <Suspense fallback={null}>
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
          <ErrorBoundary fallback="section">
            <SummaryScreen
              newAchievements={
                wm.lastSessionXp?.newAchievements?.filter(
                  a => !inGameShownIds.has(a.id),
                )
              }
            />
          </ErrorBoundary>
        )}

        {wm.screen === 'levelup' && (
          <ErrorBoundary fallback="section">
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
          </ErrorBoundary>
        )}
      </Suspense>

      <ReloadPrompt />
    </div>
    </ExerciseStateContext.Provider>
    </WorkoutContext.Provider>
  );
}

export default App;
