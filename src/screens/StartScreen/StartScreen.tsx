import { useState, useEffect } from 'react';
import { useAuth } from '@hooks/useAuth';
import { Avatar } from '@components/Avatar/Avatar';
import { DragNumberPicker } from '@components/DragNumberPicker/DragNumberPicker';
import { TimePicker } from '@components/TimePicker/TimePicker';
import { ExercisePicker } from '@components/ExercisePicker/ExercisePicker';
import { AuthModal } from '@modals/AuthModal/AuthModal';
import { ProfileModal } from '@modals/ProfileModal/ProfileModal';
import { InstallBanner } from '@overlays/InstallBanner/InstallBanner';
import type { ExerciseType } from '@exercises/types';
import './StartScreen.scss';

interface StartScreenProps {
    isModelReady: boolean;
    cameraError: string | null;
    exerciseType: ExerciseType;
    onExerciseTypeChange: (type: ExerciseType) => void;
    goalReps: number;
    onGoalChange: (value: number) => void;
    sessionMode: 'reps' | 'time';
    onSessionModeChange: (mode: 'reps' | 'time') => void;
    timeGoal: { minutes: number; seconds: number };
    onTimeGoalChange: (time: { minutes: number; seconds: number }) => void;
    onStart: () => void;
    onOpenWorkoutConfig: () => void;
}

export function StartScreen({
    isModelReady,
    cameraError,
    exerciseType,
    onExerciseTypeChange,
    goalReps,
    onGoalChange,
    sessionMode,
    onSessionModeChange,
    timeGoal,
    onTimeGoalChange,
    onStart,
    onOpenWorkoutConfig,
}: StartScreenProps) {
    const { user, dbUser, level, totalLifetimeReps, repsIntoCurrentLevel, repsNeededForNextLevel, levelProgressPct } = useAuth();
    const [showAuthModal, setShowAuthModal] = useState(false);
    const isDeepLinkFriends = window.location.hash === '#friends';
    const [showProfileModal, setShowProfileModal] = useState(isDeepLinkFriends);
    const [profileInitialTab, setProfileInitialTab] = useState<'history' | 'friends' | 'feed'>(isDeepLinkFriends ? 'friends' : 'history');

    // Clean up deep link hash after reading it
    useEffect(() => {
        if (isDeepLinkFriends) {
            history.replaceState(null, '', window.location.pathname);
        }
    }, [isDeepLinkFriends]);

    const isReady = isModelReady;

    return (
        <div className="start-screen">
            <div className="camera-vignette" />
            <InstallBanner />

            <div className="start-content">
                <div className="start-brand">
                    <div className="start-brand-header">
                        {user ? (
                            <button type="button" className="user-profile-tag" onClick={() => setShowProfileModal(true)} title="Mon profil">
                                <Avatar
                                    photoURL={dbUser?.photoURL}
                                    initials={dbUser?.displayName || 'U'}
                                    size={32}
                                    className="user-avatar"
                                />
                                <span className="user-name">{dbUser?.displayName || 'Level ' + level}</span>
                                {(dbUser?.streak ?? 0) > 0 && (
                                    <>
                                        <span className="user-streak-sep">·</span>
                                        <span className="user-streak">{dbUser?.streak} 🔥</span>
                                    </>
                                )}
                            </button>
                        ) : (
                            <button type="button" className="btn-primary-sm" onClick={() => setShowAuthModal(true)}>
                                Sign in
                            </button>
                        )}
                        <p className="start-brand-stats">Level {level} • {totalLifetimeReps} Lifetime Reps</p>
                    </div>

                    <div className="level-preview-bar">
                        <div className="level-preview-fill" style={{ width: `${levelProgressPct}%` }} />
                        <span className="level-preview-text">{repsNeededForNextLevel - repsIntoCurrentLevel} reps to Level {level + 1}</span>
                    </div>
                </div>

                <div className="start-card-divider" />

                <ExercisePicker value={exerciseType} onChange={onExerciseTypeChange} />

                <div className="start-card-divider" />

                <div className="session-mode-toggle">
                    <button
                        type="button"
                        className={`btn-toggle ${sessionMode === 'reps' ? 'active' : ''}`}
                        onClick={() => onSessionModeChange('reps')}
                    >
                        🎯 Reps
                    </button>
                    <button
                        type="button"
                        className={`btn-toggle ${sessionMode === 'time' ? 'active' : ''}`}
                        onClick={() => onSessionModeChange('time')}
                    >
                        ⏱ Time
                    </button>
                </div>

                <div className="goal-section">
                    <p className="goal-label">{sessionMode === 'reps' ? 'Set your goal' : 'Time limit'}</p>
                    {sessionMode === 'reps' ? (
                        <DragNumberPicker
                            value={goalReps}
                            min={1}
                            max={100}
                            onChange={onGoalChange}
                        />
                    ) : (
                        <TimePicker
                            value={timeGoal}
                            onChange={onTimeGoalChange}
                        />
                    )}
                </div>

                <div className="start-card-divider" />

                {cameraError && (
                    <div className="error-message">{cameraError}</div>
                )}

                {!isModelReady && (
                    <div className="status-area">
                        <div className="status-dot loading" />
                        <span>Loading AI model…</span>
                    </div>
                )}

                <button type="button" className="btn-primary" onClick={onStart} disabled={!isReady}>
                    {isReady ? (
                        sessionMode === 'reps' 
                            ? `Start — ${goalReps} rep${goalReps > 1 ? 's' : ''}`
                            : `Start — ${String(timeGoal.minutes).padStart(2, '0')}:${String(timeGoal.seconds).padStart(2, '0')}`
                    ) : 'Getting Ready…'}
                </button>

                <button type="button" className="btn-secondary" onClick={onOpenWorkoutConfig} disabled={!isReady}>
                    🏋️ Multi-Set Workout
                </button>
            </div>

            {showAuthModal && (
                <AuthModal onClose={() => setShowAuthModal(false)} />
            )}

            {showProfileModal && (
                <ProfileModal
                    initialTab={profileInitialTab}
                    onClose={() => { setShowProfileModal(false); setProfileInitialTab('history'); }}
                />
            )}
        </div>
    );
}
