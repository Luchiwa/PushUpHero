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
    const { user, dbUser, level, totalXp, xpIntoCurrentLevel, xpNeededForNextLevel, levelProgressPct } = useAuth();
    const [showAuthModal, setShowAuthModal] = useState(false);
    const isDeepLinkFriends = window.location.hash === '#friends';
    const [showProfileModal, setShowProfileModal] = useState(isDeepLinkFriends);
    const [profileInitialTab, setProfileInitialTab] = useState<'history' | 'friends' | 'feed'>(isDeepLinkFriends ? 'friends' : 'history');

    // XP bar: 12 segments
    const XP_SEG_IDS = ['s0','s1','s2','s3','s4','s5','s6','s7','s8','s9','s10','s11'];
    const filledSegments = Math.round(levelProgressPct / 100 * XP_SEG_IDS.length);

    // Tier based on level: bronze / silver / gold / diamond
    const tier = level >= 35 ? 'diamond' : level >= 20 ? 'gold' : level >= 10 ? 'silver' : 'bronze';
    const streak = dbUser?.streak ?? 0;

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
                <div className="player-hud">
                    {user ? (
                        <button type="button" className={`player-hud-card tier-${tier}`} onClick={() => setShowProfileModal(true)} title="Mon profil">
                            {/* Left: avatar + level badge */}
                            <div className="hud-avatar-wrap">
                                <Avatar
                                    photoURL={dbUser?.photoURL}
                                    initials={dbUser?.displayName || 'U'}
                                    size={44}
                                    className="hud-avatar"
                                />
                                <span className={`hud-level-badge tier-${tier}`}>LV{level}</span>
                            </div>

                            {/* Center: name + XP bar + stats row */}
                            <div className="hud-info">
                                <div className="hud-top-row">
                                    <span className="hud-name">{dbUser?.displayName || 'Player'}</span>
                                    {streak > 0 && (
                                        <span className={`hud-streak${streak >= 7 ? ' on-fire' : ''}`}>
                                            {streak}<span className="hud-streak-icon">🔥</span>
                                        </span>
                                    )}
                                    <span className="hud-total-xp">⚡{totalXp.toLocaleString()}</span>
                                </div>

                                {/* Segmented XP bar */}
                                <div className="hud-xp-bar" role="progressbar" aria-valuenow={xpIntoCurrentLevel} aria-valuemax={xpNeededForNextLevel}>
                                    {XP_SEG_IDS.map((id, i) => (
                                        <div
                                            key={id}
                                            className={`hud-xp-seg${i < filledSegments ? ' filled' : ''}${i === filledSegments - 1 && filledSegments > 0 ? ' tip' : ''}`}
                                            style={{ animationDelay: `${i * 60}ms` }}
                                        />
                                    ))}
                                </div>

                                <div className="hud-xp-label">
                                    <span>{xpIntoCurrentLevel.toLocaleString()} XP</span>
                                    <span className="hud-xp-next">→ LV{level + 1} in {(xpNeededForNextLevel - xpIntoCurrentLevel).toLocaleString()} XP</span>
                                </div>
                            </div>

                            {/* Right: chevron */}
                            <span className="hud-chevron">›</span>
                        </button>
                    ) : (
                        <div className="player-hud-guest">
                            <div className="hud-guest-info">
                                <span className="hud-guest-label">🎮 Playing as Guest</span>
                                <span className="hud-guest-sub">Sign in to save your progress</span>
                            </div>
                            <button type="button" className="hud-signin-btn" onClick={() => setShowAuthModal(true)}>
                                Sign in
                            </button>
                        </div>
                    )}
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
