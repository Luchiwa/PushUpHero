import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { useAuthCore, useLevel } from '@hooks/useAuth';
import { useSessions } from '@hooks/useAuth';
import { InstallBanner } from '@overlays/InstallBanner/InstallBanner';

// Lazy-loaded modals/screens (only parsed when opened)
const AuthModal = lazy(() => import('@modals/AuthModal/AuthModal').then(m => ({ default: m.AuthModal })));
const ProfileModal = lazy(() => import('@modals/ProfileModal/ProfileModal').then(m => ({ default: m.ProfileModal })));
const QuickSessionModal = lazy(() => import('@modals/QuickSessionModal/QuickSessionModal').then(m => ({ default: m.QuickSessionModal })));
const StatsScreen = lazy(() => import('@screens/StatsScreen/StatsScreen').then(m => ({ default: m.StatsScreen })));
const QuestsScreen = lazy(() => import('@screens/QuestsScreen/QuestsScreen').then(m => ({ default: m.QuestsScreen })));
import { useWorkout } from '@app/WorkoutContext';
import { getTier } from '@lib/xpSystem';
import type { QuestDef, QuestProgress } from '@lib/quests';
import { isQuestAccepted, QUEST_CATEGORY_META, getAvailableQuests } from '@lib/quests';
import { PlayerHUD } from './PlayerHUD/PlayerHUD';
import { QuestCard } from './QuestCard/QuestCard';
import { QuestWidget } from './QuestWidget/QuestWidget';
import { StatsWidget } from './StatsWidget/StatsWidget';
import './StartScreen.scss';

interface StartScreenProps {
    isModelReady: boolean;
    cameraError: string | null;
    activeQuest?: QuestDef | null;
    questProgress?: QuestProgress;
    userLevel?: number;
    onAcceptQuest?: (questId: string) => void;
    /** When true, auto-open the AuthModal with quest-complete promo banner */
    pendingSignupPrompt?: boolean;
    onSignupPromptHandled?: () => void;
}

export function StartScreen({
    isModelReady,
    cameraError,
    activeQuest,
    questProgress,
    userLevel,
    onAcceptQuest,
    pendingSignupPrompt,
    onSignupPromptHandled,
}: StartScreenProps) {
    const {
        exerciseType, changeExerciseType,
        setGoalReps, setSessionMode,
        handleStart, handleOpenConfig,
    } = useWorkout();
    const { user, dbUser } = useAuthCore();
    const { level, totalXp, xpIntoCurrentLevel, xpNeededForNextLevel, levelProgressPct } = useLevel();
    const { totalSessionCount } = useSessions();

    // ── Single modal state (only one modal open at a time) ──────────
    type ActiveModal =
        | null
        | { type: 'auth'; signupPromo?: boolean }
        | { type: 'profile'; initialTab: 'friends' | 'feed' }
        | { type: 'quests' }
        | { type: 'quickSession' }
        | { type: 'stats' };

    const isDeepLinkFriends = window.location.hash === '#friends';
    const [activeModal, setActiveModal] = useState<ActiveModal>(
        isDeepLinkFriends ? { type: 'profile', initialTab: 'friends' } : null,
    );
    const closeModal = useCallback(() => setActiveModal(null), []);

    // Stats for the stats button
    const totalLifetimeReps = useMemo(() => {
        if (!dbUser?.lifetimeReps) return 0;
        return Object.values(dbUser.lifetimeReps).reduce<number>((sum, v) => sum + (v ?? 0), 0);
    }, [dbUser?.lifetimeReps]);

    // Tier based on level: bronze / silver / gold / platinum
    const tier = getTier(level);
    const streak = dbUser?.streak ?? 0;

    // Clean up deep link hash after reading it
    useEffect(() => {
        if (isDeepLinkFriends) {
            history.replaceState(null, '', window.location.pathname);
        }
    }, [isDeepLinkFriends]);

    // Auto-open AuthModal with promo banner when guest just completed a quest
    useEffect(() => {
        if (pendingSignupPrompt) {
            setActiveModal({ type: 'auth', signupPromo: true });
            onSignupPromptHandled?.();
        }
    }, [pendingSignupPrompt, onSignupPromptHandled]);

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
        setGoalReps(activeQuest.goal.reps);
        setSessionMode('reps');
        // If quest requires specific exercise, set it
        if (activeQuest.goal.exerciseType) {
            changeExerciseType(activeQuest.goal.exerciseType);
        }
        handleStart();
    }, [activeQuest, setGoalReps, setSessionMode, changeExerciseType, handleStart]);

    return (
        <div className="start-screen">
            <div className="camera-vignette" />
            <InstallBanner />

            <div className="start-content">
                {/* ── Player HUD ── */}
                <PlayerHUD
                    user={user}
                    dbUser={dbUser}
                    tier={tier}
                    streak={streak}
                    level={level}
                    totalXp={totalXp}
                    xpIntoCurrentLevel={xpIntoCurrentLevel}
                    xpNeededForNextLevel={xpNeededForNextLevel}
                    levelProgressPct={levelProgressPct}
                    onOpenProfile={() => setActiveModal({ type: 'profile', initialTab: 'feed' })}
                    onOpenAuth={() => setActiveModal({ type: 'auth' })}
                />

                {/* ── Quest Hero Card ── */}
                {activeQuest && (
                    <QuestCard
                        activeQuest={activeQuest}
                        questAccepted={!!questAccepted}
                        isCalibrationQuest={!!isCalibrationQuest}
                        catMeta={catMeta}
                        isReady={isReady}
                        exerciseType={exerciseType}
                        changeExerciseType={changeExerciseType}
                        onAcceptQuest={handleAcceptQuest}
                        onQuestStart={handleQuestStart}
                    />
                )}

                {/* ── Quest Widget (always visible when onboarding done) ── */}
                {user && onboardingDone && (
                    <QuestWidget
                        activeQuest={activeQuest}
                        questAccepted={!!questAccepted}
                        allQuestsCompleted={!!allQuestsCompleted}
                        availableCount={availableCount}
                        completedCount={completedCount}
                        onOpen={() => setActiveModal({ type: 'quests' })}
                    />
                )}

                {/* ── Stats Widget (logged-in only) ── */}
                {user && dbUser && totalSessionCount > 0 && (
                    <StatsWidget
                        streak={streak}
                        totalLifetimeReps={totalLifetimeReps}
                        totalSessionCount={totalSessionCount}
                        onOpen={() => setActiveModal({ type: 'stats' })}
                    />
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
                    <button type="button" className="btn-quick-session" onClick={() => setActiveModal({ type: 'quickSession' })} disabled={!isReady}>
                        ⚡ Quick Session
                    </button>
                )}

                {/* ── Multi-Set Workout ── */}
                {onboardingDone && (
                    <button type="button" className="btn-secondary" onClick={handleOpenConfig} disabled={!isReady}>
                        🏋️ Multi-Set Workout
                    </button>
                )}
            </div>

            <Suspense fallback={null}>
                {activeModal?.type === 'quickSession' && (
                    <QuickSessionModal onClose={closeModal} isReady={isReady} />
                )}

                {activeModal?.type === 'stats' && (
                    <StatsScreen onClose={closeModal} />
                )}

                {activeModal?.type === 'auth' && (
                    <AuthModal
                        onClose={closeModal}
                        initialMode={activeModal.signupPromo ? 'register' : undefined}
                        promoBanner={
                            activeModal.signupPromo
                                ? (
                                    <>
                                        <p className="auth-promo-title">
                                            <span>🎉</span> Quest complete — don't lose your progress!
                                        </p>
                                        <ul className="auth-promo-perks">
                                            <li className="auth-promo-perk">
                                                <span className="perk-icon">💾</span>
                                                Save your XP, level & stats forever
                                            </li>
                                            <li className="auth-promo-perk">
                                                <span className="perk-icon">🏆</span>
                                                Unlock achievements & leaderboards
                                            </li>
                                            <li className="auth-promo-perk">
                                                <span className="perk-icon">📈</span>
                                                Track your progress across devices
                                            </li>
                                        </ul>
                                    </>
                                )
                                : undefined
                        }
                    />
                )}

                {activeModal?.type === 'profile' && (
                    <ProfileModal initialTab={activeModal.initialTab} onClose={closeModal} />
                )}

                {activeModal?.type === 'quests' && questProgress != null && (
                    <QuestsScreen
                        onClose={closeModal}
                        questProgress={questProgress}
                        userLevel={userLevel ?? 0}
                        onAcceptQuest={onAcceptQuest}
                    />
                )}
            </Suspense>
        </div>
    );
}
