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
import { useSessionHistory } from './hooks/useSessionHistory';

type AppScreen = 'idle' | 'active' | 'victory' | 'stopped';
type FacingMode = 'user' | 'environment';

function App() {
  const [screen, setScreen] = useState<AppScreen>('idle');
  const [goalReps, setGoalReps] = useState(10);
  const [facingMode, setFacingMode] = useState<FacingMode>('user');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const detector = useMemo(() => new PushUpDetector(), []);
  const { addSession } = useSessionHistory();

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
      });
    }
  };

  const handleStart = () => setScreen('active');
  const handleStop = () => { saveCurrentSession(); setScreen('stopped'); };
  const handleVictory = () => setScreen('victory');
  const handleVictoryComplete = () => { saveCurrentSession(); setScreen('stopped'); };
  const handleReset = () => {
    resetDetector();
    setScreen('idle');
  };

  // Trigger victory screen when goal is reached
  if (screen === 'active' && exerciseState.repCount >= goalReps) {
    handleVictory();
  }

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
            onStop={handleStop}
            onFlipCamera={() => setFacingMode(m => m === 'user' ? 'environment' : 'user')}
            facingMode={facingMode}
            soundEnabled={soundEnabled}
            onSoundToggle={() => setSoundEnabled(s => !s)}
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
          onStart={handleStart}
        />
      )}

      {screen === 'stopped' && (
        <SummaryScreen exerciseState={exerciseState} onReset={handleReset} />
      )}

      {screen === 'victory' && (
        <VictoryOverlay
          repCount={exerciseState.repCount}
          soundEnabled={soundEnabled}
          onComplete={handleVictoryComplete}
        />
      )}

      {/* Global PWA Update notifier */}
      <ReloadPrompt />
    </div>
  );
}

export default App;
