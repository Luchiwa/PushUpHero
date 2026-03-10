import { useMemo, useState } from 'react';
import { useCamera } from './hooks/useCamera';
import { usePoseDetection } from './hooks/usePoseDetection';
import { useExerciseDetector } from './hooks/useExerciseDetector';
import { PushUpDetector } from './exercises/pushup/PushUpDetector';
import { StartScreen } from './components/StartScreen';
import { PoseOverlay } from './components/PoseOverlay';
import { Dashboard } from './components/Dashboard';
import { SummaryScreen } from './components/SummaryScreen';
import { PositionGuide } from './components/PositionGuide';
import { ReloadPrompt } from './components/ReloadPrompt';
import { VictoryOverlay } from './components/VictoryOverlay';
import { useRef, useEffect } from 'react';
import { useSessionHistory } from './hooks/useSessionHistory';
import { useLevelSystem } from './hooks/useLevelSystem';
import { useSoundEffect } from './hooks/useSoundEffect';

type AppScreen = 'idle' | 'active' | 'victory' | 'stopped';
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
  const { level, levelProgressPct, addRepsToLifetime } = useLevelSystem();

  // Track reps and level safely at root so we don't lose the critical final rep if the dashboard unmounts.
  const prevRepCountRef = useRef(0);
  const prevLevelRef = useRef(level);
  const elapsedTimeRef = useRef(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  const { videoRef, isReady: isCameraReady, error: cameraError } = useCamera({ facingMode });

  const { landmarks, rawResult, isModelReady } = usePoseDetection({
    videoRef,
    isVideoReady: isCameraReady,
    isActive: screen === 'active',
  });

  const { exerciseState, resetDetector } = useExerciseDetector({
    detector,
    landmarks,
    isActive: screen === 'active',
  });

  const saveCurrentSession = () => {
    if (exerciseState.repCount > 0) {
      addSession({
        reps: exerciseState.repCount,
        averageScore: Math.round(exerciseState.averageScore),
        goalReps,
        sessionMode,
        elapsedTime: sessionMode === 'time' ? elapsedTimeRef.current : undefined,
      });
    }
  };

  const handleStart = () => {
    prevRepCountRef.current = exerciseState.repCount; // Reset base
    elapsedTimeRef.current = 0; // Reset elapsed time for new session
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
    resetDetector();
    prevRepCountRef.current = 0;
    elapsedTimeRef.current = 0; // Reset elapsed time
    setScreen('idle');
  };

  // Securely track rep increments specifically for lifetime global state
  // We do it here in App because Dashboard can unmount instantly on the 10th rep.
  useEffect(() => {
    if (screen === 'active' || screen === 'victory') { // still count if it just flipped to victory
      if (exerciseState.repCount > prevRepCountRef.current) {
        const repsDone = exerciseState.repCount - prevRepCountRef.current;
        addRepsToLifetime(repsDone);
        prevRepCountRef.current = exerciseState.repCount;
      }
    }
  }, [exerciseState.repCount, addRepsToLifetime, screen]);

  // Track global level ups
  useEffect(() => {
    if (level > prevLevelRef.current) {
      initAudio();
      if (soundEnabled) playLevelUpSound();
    }
    prevLevelRef.current = level;
  }, [level, soundEnabled, playLevelUpSound, initAudio]);

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
            rawResult={rawResult}
            videoRef={videoRef}
            phase={exerciseState.currentPhase}
            isValidPosition={exerciseState.isValidPosition}
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
            onFlipCamera={() => setFacingMode(m => m === 'user' ? 'environment' : 'user')}
            facingMode={facingMode}
            soundEnabled={soundEnabled}
            onSoundToggle={() => setSoundEnabled(s => !s)}
            level={level}
            levelProgressPct={levelProgressPct}
          />
        </>
      )}

      {screen === 'idle' && (
        <StartScreen
          videoRef={videoRef}
          isModelReady={isModelReady}
          isCameraReady={isCameraReady}
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
