import { useMemo, useState } from 'react';
import { useCamera } from './hooks/useCamera';
import { usePoseDetection } from './hooks/usePoseDetection';
import { useExerciseDetector } from './hooks/useExerciseDetector';
import { PushUpDetector } from './exercises/pushup/PushUpDetector';
import { StartScreen } from './components/StartScreen/StartScreen';
import { PoseOverlay } from './components/PoseOverlay/PoseOverlay';
import type { PoseOverlayHandle } from './components/PoseOverlay/PoseOverlay';
import { Dashboard } from './components/Dashboard/Dashboard';
import { SummaryScreen } from './components/SummaryScreen/SummaryScreen';
import { LevelUpScreen } from './components/LevelUpScreen/LevelUpScreen';
import { PositionGuide } from './components/PositionGuide/PositionGuide';
import { ReloadPrompt } from './components/ReloadPrompt/ReloadPrompt';
import { VictoryOverlay } from './components/VictoryOverlay/VictoryOverlay';
import { useRef, useEffect } from 'react';
import { useSessionHistory } from './hooks/useSessionHistory';
import { useAuth } from './hooks/useAuth';
import { useSoundEffect } from './hooks/useSoundEffect';
import { calculateLevelFromTotalReps, calculateTotalRepsForLevel } from './hooks/useLevelSystem';
import './components/App/App.scss';

type AppScreen = 'idle' | 'active' | 'victory' | 'stopped' | 'levelup';
type FacingMode = 'user' | 'environment';
type SessionMode = 'reps' | 'time';

function App() {
  const [screen, setScreen] = useState<AppScreen>('idle');
  const [goalReps, setGoalReps] = useState(10);
  const [sessionMode, setSessionMode] = useState<SessionMode>('reps');
  const [timeGoal, setTimeGoal] = useState({ minutes: 0, seconds: 30 });
  const [facingMode, setFacingMode] = useState<FacingMode>('user');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const detector = useMemo(() => new PushUpDetector(), []);
  const { addSession } = useSessionHistory();
  const { initAudio, playLevelUpSound } = useSoundEffect();

  // Root-level tracking for global lifetime reps and levels
  const { totalLifetimeReps } = useAuth();

  // Track reps and level safely at root so we don't lose the critical final rep if the dashboard unmounts.
  const prevLevelRef = useRef(0);
  const [levelBefore, setLevelBefore] = useState(0);
  const elapsedTimeRef = useRef(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const sessionSavedRef = useRef(false); // guard against double-save

  const cameraEnabled = screen === 'active';
  const { videoRef, isReady: isCameraReady, error: cameraError, triggerStart: startCamera } = useCamera({ facingMode, enabled: cameraEnabled });

  const poseOverlayRef = useRef<PoseOverlayHandle>(null);

  const { exerciseState, processLandmarks, resetDetector } = useExerciseDetector({
    detector,
    isActive: screen === 'active',
  });

  // exerciseState ref kept fresh so onFrame closure always sees latest phase/validity
  const exerciseStateRef = useRef(exerciseState);
  useEffect(() => { exerciseStateRef.current = exerciseState; }, [exerciseState]);

  // Project level + progress in real-time from totalLifetimeReps + current repCount.
  // repCount is only added during the active/victory phase — once the session is saved,
  // totalLifetimeReps already includes those reps, so we must not double-count.
  const sessionReps = (screen === 'active' || screen === 'victory') ? exerciseState.repCount : 0;
  const liveTotal = totalLifetimeReps + sessionReps;
  const liveLevel = calculateLevelFromTotalReps(liveTotal);
  const liveLevelBase = calculateTotalRepsForLevel(liveLevel);
  const liveLevelNext = calculateTotalRepsForLevel(liveLevel + 1);
  const liveProgressPct = ((liveTotal - liveLevelBase) / (liveLevelNext - liveLevelBase)) * 100;

  const { isModelReady } = usePoseDetection({
    videoRef,
    isVideoReady: isCameraReady,
    isActive: screen === 'active',
    onFrame: (landmarks, rawResult) => {
      processLandmarks(landmarks);
      poseOverlayRef.current?.drawResult(
        rawResult,
        exerciseStateRef.current.currentPhase,
        exerciseStateRef.current.isValidPosition,
      );
    },
  });

  const saveCurrentSession = () => {
    if (sessionSavedRef.current) return; // prevent double-save
    if (exerciseState.repCount > 0) {
      sessionSavedRef.current = true;
      addSession({
        reps: exerciseState.repCount,
        averageScore: Math.round(exerciseState.averageScore),
        goalReps,
        sessionMode,
        elapsedTime: sessionMode === 'time' ? elapsedTimeRef.current : undefined,
      }).catch(err => {
        console.error('Failed to save session:', err);
        sessionSavedRef.current = false; // allow retry on error
      });
    }
  };

  const handleStart = () => {
    elapsedTimeRef.current = 0;
    sessionSavedRef.current = false;
    setLevelBefore(liveLevel); // snapshot from projected live level
    startCamera();
    setScreen('active');
  };
  const handleStop = () => { 
    saveCurrentSession();
    // Skip summary if 0 reps (both reps and time mode)
    if ((sessionMode === 'reps' || sessionMode === 'time') && exerciseState.repCount === 0) {
      setScreen('idle');
    } else {
      setElapsedTime(elapsedTimeRef.current);
      setScreen('stopped');
    }
  };
  const handleTimerEnd = () => {
    // Time mode: always go through victory screen
    setElapsedTime(elapsedTimeRef.current);
    setScreen('victory');
  };
  const handleVictory = () => setScreen('victory');
  const handleVictoryComplete = () => { saveCurrentSession(); setElapsedTime(elapsedTimeRef.current); setScreen('stopped'); };
  const handleReset = () => {
    if (liveLevel > levelBefore) {
      setScreen('levelup');
      return;
    }
    resetDetector();
    elapsedTimeRef.current = 0;
    setScreen('idle');
  };

  const handleLevelUpContinue = () => {
    resetDetector();
    elapsedTimeRef.current = 0;
    setScreen('idle');
  };

  // Track level-ups in real-time during active sessions
  useEffect(() => {
    if (screen === 'active' && liveLevel > prevLevelRef.current) {
      initAudio();
      if (soundEnabled) playLevelUpSound();
    }
    prevLevelRef.current = liveLevel;
  }, [liveLevel, screen, soundEnabled, playLevelUpSound, initAudio]);

  // Trigger victory screen when goal is reached (reps mode only)
  useEffect(() => {
    if (screen === 'active' && sessionMode === 'reps' && exerciseState.repCount >= goalReps) {
      setElapsedTime(elapsedTimeRef.current);
      handleVictory();
    }
  }, [exerciseState.repCount, screen, sessionMode, goalReps]);

  return (
    <div className="app-container">
      {/* Video always in DOM — stream stays alive across screen transitions */}
      <video
        ref={videoRef}
        className={`video-fullscreen ${screen !== 'active' ? 'video-hidden' : ''} ${facingMode === 'environment' ? 'video-no-mirror' : ''}`}
        muted
        playsInline
      />

      {screen === 'active' && (
        <>
          <PoseOverlay
            ref={poseOverlayRef}
            videoRef={videoRef}
          />
          <PositionGuide
            isCalibrated={exerciseState.isCalibrated}
            calibratingPercentage={exerciseState.calibratingPercentage}
          />
          <Dashboard
            exerciseState={exerciseState}
            goalReps={goalReps}
            sessionMode={sessionMode}
            timeGoal={timeGoal}
            onStop={handleStop}
            onTimerEnd={handleTimerEnd}
            elapsedTimeRef={elapsedTimeRef}
            onFlipCamera={() => {
                const newMode = facingMode === 'user' ? 'environment' : 'user';
                setFacingMode(newMode);
                startCamera(newMode);
            }}
            facingMode={facingMode}
            soundEnabled={soundEnabled}
            onSoundToggle={() => setSoundEnabled(s => !s)}
            level={liveLevel}
            levelProgressPct={liveProgressPct}
          />
        </>
      )}

      {screen === 'idle' && (
        <StartScreen
          videoRef={videoRef}
          isModelReady={isModelReady}
          cameraError={cameraError}
          goalReps={goalReps}
          onGoalChange={setGoalReps}
          sessionMode={sessionMode}
          onSessionModeChange={setSessionMode}
          timeGoal={timeGoal}
          onTimeGoalChange={setTimeGoal}
          onStart={handleStart}
        />
      )}

      {screen === 'stopped' && (
        <SummaryScreen 
          exerciseState={exerciseState} 
          onReset={handleReset}
          sessionMode={sessionMode}
          elapsedTime={elapsedTime}
        />
      )}

      {screen === 'levelup' && (
        <LevelUpScreen
          previousLevel={levelBefore}
          newLevel={liveLevel}
          onContinue={handleLevelUpContinue}
        />
      )}

      {screen === 'victory' && (
        <VictoryOverlay
          repCount={exerciseState.repCount}
          soundEnabled={soundEnabled}
          onComplete={handleVictoryComplete}
          sessionMode={sessionMode}
          elapsedTime={elapsedTime}
        />
      )}

      {/* Global PWA Update notifier */}
      <ReloadPrompt />
    </div>
  );
}

export default App;
