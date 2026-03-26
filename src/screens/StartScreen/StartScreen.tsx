import { useState, useEffect, useCallback } from 'react';
import { useAuthCore, useLevel } from '@hooks/useAuth';
import { Avatar } from '@components/Avatar/Avatar';
import { ExercisePicker } from '@components/ExercisePicker/ExercisePicker';
import { AuthModal } from '@modals/AuthModal/AuthModal';
import { ProfileModal } from '@modals/ProfileModal/ProfileModal';
import { QuickSessionModal } from '@modals/QuickSessionModal/QuickSessionModal';
import { InstallBanner } from '@overlays/InstallBanner/InstallBanner';
import { QuestsScreen } from '@screens/QuestsScreen/QuestsScreen';
import type { ExerciseType } from '@exercises/types';
import type { QuestDef, QuestProgress } from '@lib/quests';
import { isQuestAccepted, QUEST_CATEGORY_META, getAvailableQuests } from '@lib/quests';
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
    activeQuest?: QuestDef | null;
    questProgress?: QuestProgress;
    userLevel?: number;
    onAcceptQuest?: (questId: string) => void;
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
    activeQuest,
    questProgress,
    userLevel,
    onAcceptQuest,
}: StartScreenProps) {
    const { user, dbUser } = useAuthCore();
    const { level, totalXp, xpIntoCurrentLevel, xpNeededForNextLevel, levelProgressPct } = useLevel();
    const [showAuthModal, setShowAuthModal] = useState(false);
    const isDeepLinkFriends = window.location.hash === '#friends';
    const [showProfileModal, setShowProfileModal] = useState(isDeepLinkFriends);
    const [profileInitialTab, setProfileInitialTab] = useState<'history' | 'friends' | 'feed'>(isDeepLinkFriends ? 'friends' : 'history');
    const [showQuestsScreen, setShowQuestsScreen] = useState(false);
    const [showQuickSession, setShowQuickSession] = useState(false);

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

    // Quest state helpers
    const questAccepted = activeQuest && questProgress ? isQuestAccepted(activeQuest, questProgress) : false;
    const isCalibrationQuest = activeQuest?.id === 'first_steps';
    const hasAvailableQuests = questProgress ? getAvailableQuests(questProgress, userLevel ?? 0).length > 0 : false;
    const allQuestsCompleted = questProgress && Object.keys(questProgress.completed).length > 0 && !hasAvailableQuests;
    const catMeta = activeQuest ? QUEST_CATEGORY_META[activeQuest.category] : null;
    const onboardingDone = !!questProgress?.completed['first_steps'];

    // Accept quest handler
    const handleAcceptQuest = useCallback(() => {
        if (activeQuest && onAcceptQuest) {
            onAcceptQuest(activeQuest.id);
        }
    }, [activeQuest, onAcceptQuest]);

    // Start from quest (calibration: exercise picker shown, then start)
    const handleQuestStart = useCallback(() => {
        if (!activeQuest) return;
        // Set goal to quest goal reps
        onGoalChange(activeQuest.goal.reps);
        onSessionModeChange('reps');
        // If quest requires specific exercise, set it
        if (activeQuest.goal.exerciseType) {
            onExerciseTypeChange(activeQuest.goal.exerciseType);
        }
        onStart();
    }, [activeQuest, onGoalChange, onSessionModeChange, onExerciseTypeChange, onStart]);

    return (
        <div className="start-screen">
            <div className="camera-vignette" />
            <InstallBanner />

            <div className="start-content">
                {/* ── Player HUD ── */}
                <div className="player-hud">
                    {user ? (
                        <button type="button" className={`player-hud-card tier-${tier}`} onClick={() => setShowProfileModal(true)} title="Mon profil">
                            <div className="hud-avatar-wrap">
                                <Avatar
                                    photoURL={dbUser?.photoURL}
                                    initials={dbUser?.displayName || 'U'}
                                    size={44}
                                    className="hud-avatar"
                                />
                                <span className={`hud-level-badge tier-${tier}`}>LV{level}</span>
                            </div>

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

                {/* ── Quest Hero Card ── */}
                {activeQuest && !questAccepted && (
                    <div className="quest-card" style={{ '--quest-color': catMeta?.color ?? '#6366f1' } as React.CSSProperties}>
                        <div className="quest-card-header">
                            <span className="quest-card-badge" style={{ background: catMeta?.color }}>{catMeta?.label}</span>
                            <span className="quest-card-xp">+{activeQuest.xpReward} XP</span>
                        </div>
                        <div className="quest-card-main">
                            <span className="quest-card-emoji">{activeQuest.emoji}</span>
                            <div className="quest-card-text">
                                <h3 className="quest-card-title">{activeQuest.title}</h3>
                                <p className="quest-card-desc">{activeQuest.description}</p>
                            </div>
                        </div>
                        <button type="button" className="quest-card-accept" onClick={handleAcceptQuest} disabled={!isReady}>
                            ✨ Accept Quest
                        </button>
                    </div>
                )}

                {/* ── Accepted Quest: Calibration (first_steps) ── */}
                {activeQuest && questAccepted && isCalibrationQuest && (
                    <div className="quest-card quest-card--active" style={{ '--quest-color': catMeta?.color ?? '#6366f1' } as React.CSSProperties}>
                        <div className="quest-card-header">
                            <span className="quest-card-badge" style={{ background: catMeta?.color }}>{catMeta?.label}</span>
                            <span className="quest-card-xp">+{activeQuest.xpReward} XP</span>
                        </div>
                        <div className="quest-card-main">
                            <span className="quest-card-emoji">{activeQuest.emoji}</span>
                            <div className="quest-card-text">
                                <h3 className="quest-card-title">{activeQuest.title}</h3>
                                <p className="quest-card-desc">{activeQuest.description}</p>
                            </div>
                        </div>

                        <div className="quest-card-config">
                            <ExercisePicker value={exerciseType} onChange={onExerciseTypeChange} />
                        </div>

                        <button type="button" className="quest-card-start" onClick={handleQuestStart} disabled={!isReady}>
                            {isReady ? `🚀 Start — ${activeQuest.goal.reps} reps` : 'Getting Ready…'}
                        </button>
                    </div>
                )}

                {/* ── Accepted Quest: Normal (in progress) ── */}
                {activeQuest && questAccepted && !isCalibrationQuest && (
                    <div className="quest-card quest-card--active" style={{ '--quest-color': catMeta?.color ?? '#6366f1' } as React.CSSProperties}>
                        <div className="quest-card-header">
                            <span className="quest-card-badge" style={{ background: catMeta?.color }}>{catMeta?.label}</span>
                            <span className="quest-card-status">In progress</span>
                            <span className="quest-card-xp">+{activeQuest.xpReward} XP</span>
                        </div>
                        <div className="quest-card-main">
                            <span className="quest-card-emoji">{activeQuest.emoji}</span>
                            <div className="quest-card-text">
                                <h3 className="quest-card-title">{activeQuest.title}</h3>
                                <p className="quest-card-desc">{activeQuest.description}</p>
                            </div>
                        </div>
                        <p className="quest-card-hint">Complete a session to progress this quest.</p>
                    </div>
                )}

                {/* ── No active quest: show browse button ── */}
                {!activeQuest && hasAvailableQuests && (
                    <button type="button" className="quest-browse-btn" onClick={() => setShowQuestsScreen(true)}>
                        📜 View available quests
                    </button>
                )}

                {/* ── All quests done ── */}
                {allQuestsCompleted && (
                    <button type="button" className="quest-browse-btn quest-browse-btn--done" onClick={() => setShowQuestsScreen(true)}>
                        🏆 All quests completed!
                    </button>
                )}

                <div className="start-card-divider" />

                {/* ── Status / errors ── */}
                {cameraError && (
                    <div className="error-message">{cameraError}</div>
                )}

                {!isModelReady && (
                    <div className="status-area">
                        <div className="status-dot loading" />
                        <span>Loading AI model…</span>
                    </div>
                )}

                {/* ── Quick Session button ── */}
                {onboardingDone && (
                    <button type="button" className="btn-quick-session" onClick={() => setShowQuickSession(true)} disabled={!isReady}>
                        ⚡ Quick Session
                    </button>
                )}

                {/* ── Multi-Set Workout ── */}
                {onboardingDone && (
                    <button type="button" className="btn-secondary" onClick={onOpenWorkoutConfig} disabled={!isReady}>
                        🏋️ Multi-Set Workout
                    </button>
                )}
            </div>

            {showQuickSession && (
                <QuickSessionModal
                    exerciseType={exerciseType}
                    onExerciseTypeChange={onExerciseTypeChange}
                    sessionMode={sessionMode}
                    onSessionModeChange={onSessionModeChange}
                    goalReps={goalReps}
                    onGoalChange={onGoalChange}
                    timeGoal={timeGoal}
                    onTimeGoalChange={onTimeGoalChange}
                    onStart={onStart}
                    onClose={() => setShowQuickSession(false)}
                    isReady={isReady}
                />
            )}

            {showAuthModal && (
                <AuthModal onClose={() => setShowAuthModal(false)} />
            )}

            {showProfileModal && (
                <ProfileModal
                    initialTab={profileInitialTab}
                    onClose={() => { setShowProfileModal(false); setProfileInitialTab('history'); }}
                />
            )}

            {showQuestsScreen && questProgress != null && (
                <QuestsScreen
                    onClose={() => setShowQuestsScreen(false)}
                    questProgress={questProgress}
                    userLevel={userLevel ?? 0}
                    onAcceptQuest={onAcceptQuest}
                />
            )}
        </div>
    );
}
