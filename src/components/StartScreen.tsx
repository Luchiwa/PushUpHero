import { useState } from 'react';
import { useLevelSystem } from '../hooks/useLevelSystem';
import { useAuth } from '../hooks/useAuth';
import { DragNumberPicker } from './DragNumberPicker';
import { SessionHistoryPanel } from './SessionHistoryPanel';
import { AuthModal } from './AuthModal';
import { ProfileModal } from './ProfileModal';

interface StartScreenProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    isModelReady: boolean;
    isCameraReady: boolean;
    cameraError: string | null;
    goalReps: number;
    onGoalChange: (value: number) => void;
    onStart: () => void;
}

export function StartScreen({
    isModelReady,
    isCameraReady,
    cameraError,
    goalReps,
    onGoalChange,
    onStart,
}: StartScreenProps) {
    const { level, totalLifetimeReps, repsNeededForNextLevel, levelProgressPct } = useLevelSystem();
    const { user, dbUser } = useAuth();
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);

    const isReady = isModelReady && isCameraReady;

    return (
        <div className="start-screen">
            <div className="auth-profile-badge">
                {user ? (
                    <div className="user-profile-tag" onClick={() => setShowProfileModal(true)} title="Mon profil">
                        <span className="user-avatar">{dbUser?.displayName?.[0]?.toUpperCase() || 'U'}</span>
                        <span className="user-name">{dbUser?.displayName || 'Level ' + level}</span>
                    </div>
                ) : (
                    <button className="btn-signin-small" onClick={() => setShowAuthModal(true)}>
                        Connexion
                    </button>
                )}
            </div>

            <div className="camera-vignette" />

            <div className="start-card">
                <div className="start-brand">
                    <h1>Push-Up Hero</h1>
                    <p>Level {level} • {totalLifetimeReps} Lifetime Reps</p>

                    <div className="level-preview-bar">
                        <div className="level-preview-fill" style={{ width: `${levelProgressPct}%` }} />
                        <span className="level-preview-text">{repsNeededForNextLevel} reps to Level {level + 1}</span>
                    </div>
                </div>

                <div className="start-card-divider" />

                <div className="goal-section">
                    <p className="goal-label">Set your goal</p>
                    <DragNumberPicker
                        value={goalReps}
                        min={1}
                        max={100}
                        onChange={onGoalChange}
                    />
                </div>

                <div className="start-card-divider" />

                <SessionHistoryPanel />

                {cameraError ? (
                    <div className="error-message">{cameraError}</div>
                ) : (
                    <div className="status-area">
                        <div className={`status-dot ${isCameraReady ? 'ready' : 'loading'}`} />
                        <span>{isCameraReady ? 'Camera ready' : 'Initializing camera…'}</span>
                    </div>
                )}

                <div className="status-area">
                    <div className={`status-dot ${isModelReady ? 'ready' : 'loading'}`} />
                    <span>{isModelReady ? 'AI model ready' : 'Loading AI model…'}</span>
                </div>

                <button className="btn-primary" onClick={onStart} disabled={!isReady}>
                    {isReady ? `Start — ${goalReps} rep${goalReps > 1 ? 's' : ''}` : 'Getting Ready…'}
                </button>

                <p className="hint">Position yourself facing the camera in a push-up stance</p>
            </div>

            {showAuthModal && (
                <AuthModal onClose={() => setShowAuthModal(false)} />
            )}

            {showProfileModal && (
                <ProfileModal onClose={() => setShowProfileModal(false)} />
            )}
        </div>
    );
}
