import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthCore, useLevel } from '@hooks/useAuth';
import { useSessions } from '@hooks/useAuth';
import { Avatar } from '@components/Avatar/Avatar';
import { ExercisePicker } from '@components/ExercisePicker/ExercisePicker';
import { AuthModal } from '@modals/AuthModal/AuthModal';
import { ProfileModal } from '@modals/ProfileModal/ProfileModal';
import { QuickSessionModal } from '@modals/QuickSessionModal/QuickSessionModal';
import { StatsScreen } from '@screens/StatsScreen/StatsScreen';
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
    const { totalSessionCount } = useSessions();
    const [showAuthModal, setShowAuthModal] = useState(false);
    const isDeepLinkFriends = window.location.hash === '#friends';
    const [showProfileModal, setShowProfileModal] = useState(isDeepLinkFriends);
    const [profileInitialTab, setProfileInitialTab] = useState<'friends' | 'feed'>(isDeepLinkFriends ? 'friends' : 'feed');
    const [showQuestsScreen, setShowQuestsScreen] = useState(false);
    const [showQuickSession, setShowQuickSession] = useState(false);
    const [showStats, setShowStats] = useState(false);

    // Stats for the stats button
    const totalLifetimeReps = useMemo(() => {
        if (!dbUser?.lifetimeReps) return 0;
        return Object.values(dbUser.lifetimeReps).reduce((sum, v) => sum + (v ?? 0), 0);
    }, [dbUser?.lifetimeReps]);

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
    const availableQuests = questProgress ? getAvailableQuests(questProgress, userLevel ?? 0) : [];
    const availableCount = availableQuests.length;
    const hasAvailableQuests = availableCount > 0;
    const allQuestsCompleted = questProgress && Object.keys(questProgress.completed).length > 0 && !hasAvailableQuests;
    const completedCount = questProgress ? Object.keys(questProgress.completed).length : 0;
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

                {/* ── Quest Widget (always visible when onboarding done) ── */}
                {user && onboardingDone && (
                    <button type="button" className="quest-widget" onClick={() => setShowQuestsScreen(true)}>
                        <div className="quest-widget-shine" />

                        {/* Scroll icon */}
                        <div className="quest-widget-icon-wrap">
                            <svg className="quest-widget-icon" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="16" y1="13" x2="8" y2="13" />
                                <line x1="16" y1="17" x2="8" y2="17" />
                            </svg>
                            {availableCount > 0 && (
                                <span className="quest-widget-notif">{availableCount}</span>
                            )}
                        </div>

                        {/* Info */}
                        <div className="quest-widget-info">
                            <div className="quest-widget-top">
                                <span className="quest-widget-title">Quests</span>
                                {allQuestsCompleted ? (
                                    <span className="quest-widget-badge quest-widget-badge--done">✓ All done</span>
                                ) : availableCount > 0 ? (
                                    <span className="quest-widget-badge">{availableCount} available</span>
                                ) : null}
                            </div>
                            <div className="quest-widget-preview">
                                {activeQuest && questAccepted ? (
                                    <>
                                        <span className="quest-widget-quest-emoji">{activeQuest.emoji}</span>
                                        <span className="quest-widget-quest-name">{activeQuest.title}</span>
                                        <span className="quest-widget-quest-status"><span className="quest-widget-quest-dot" />In progress</span>
                                    </>
                                ) : activeQuest && !questAccepted ? (
                                    <>
                                        <span className="quest-widget-quest-emoji">{activeQuest.emoji}</span>
                                        <span className="quest-widget-quest-name">{activeQuest.title}</span>
                                        <span className="quest-widget-quest-status quest-widget-quest-status--new">✨ New</span>
                                    </>
                                ) : allQuestsCompleted ? (
                                    <span className="quest-widget-completed">🏆 {completedCount} quests conquered</span>
                                ) : (
                                    <span className="quest-widget-browse">Browse available quests →</span>
                                )}
                            </div>
                        </div>

                        {/* Chevron */}
                        <svg className="quest-widget-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                    </button>
                )}

                {/* ── Stats Widget (logged-in only) ── */}
                {user && dbUser && totalSessionCount > 0 && (
                    <button type="button" className="stats-widget" onClick={() => setShowStats(true)}>
                        <div className="stats-widget-shine" />

                        {/* Streak ring */}
                        <div className="stats-widget-ring-wrap">
                            <svg className="stats-widget-ring" viewBox="0 0 48 48" width="48" height="48">
                                <circle className="stats-widget-ring-track" cx="24" cy="24" r="20" />
                                <circle
                                    className="stats-widget-ring-fill"
                                    cx="24" cy="24" r="20"
                                    strokeDasharray={`${Math.min(streak / 7, 1) * 125.6} 125.6`}
                                />
                            </svg>
                            <span className="stats-widget-ring-label">{streak}<span className="stats-widget-ring-fire">🔥</span></span>
                        </div>

                        {/* Stats columns */}
                        <div className="stats-widget-data">
                            <div className="stats-widget-row">
                                <div className="stats-widget-stat">
                                    <svg className="stats-widget-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
                                    </svg>
                                    <span className="stats-widget-val">{totalLifetimeReps.toLocaleString()}</span>
                                    <span className="stats-widget-lbl">reps</span>
                                </div>
                                <div className="stats-widget-stat">
                                    <svg className="stats-widget-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                                    </svg>
                                    <span className="stats-widget-val">{totalSessionCount}</span>
                                    <span className="stats-widget-lbl">sessions</span>
                                </div>
                            </div>
                        </div>

                        {/* CTA badge */}
                        <div className="stats-widget-cta">
                            <span>📊</span>
                            <span>View full stats</span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                        </div>
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

            {showStats && (
                <StatsScreen onClose={() => setShowStats(false)} />
            )}

            {showAuthModal && (
                <AuthModal onClose={() => setShowAuthModal(false)} />
            )}

            {showProfileModal && (
                <ProfileModal
                    initialTab={profileInitialTab}
                    onClose={() => { setShowProfileModal(false); setProfileInitialTab('feed'); }}
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
