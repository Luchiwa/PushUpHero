import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { useAuthCore, useLevel, useSessions } from '@hooks/useAuth';
import { InstallBanner } from '@overlays/InstallBanner/InstallBanner';
import { PrimaryCTA } from '@components/PrimaryCTA/PrimaryCTA';

// Lazy-loaded modals/screens (only parsed when opened)
const AuthModal = lazy(() => import('@modals/AuthModal/AuthModal').then(m => ({ default: m.AuthModal })));
const ProfileModal = lazy(() => import('@modals/ProfileModal/ProfileModal').then(m => ({ default: m.ProfileModal })));
const QuickSessionModal = lazy(() => import('@modals/QuickSessionModal/QuickSessionModal').then(m => ({ default: m.QuickSessionModal })));
const StatsScreen = lazy(() => import('@screens/StatsScreen/StatsScreen').then(m => ({ default: m.StatsScreen })));
const QuestsScreen = lazy(() => import('@screens/QuestsScreen/QuestsScreen').then(m => ({ default: m.QuestsScreen })));
import { useWorkout } from '@app/WorkoutContext';
import { QUEST_CATEGORY_META, getAcceptedQuests, getAvailableQuests, getTier, isQuestAccepted, type QuestDef, type QuestProgress } from '@domain';
import { getWorkoutCheckpoint } from '@services/workoutCheckpointStore';
import { PlayerHUD } from './PlayerHUD/PlayerHUD';
import { QuestCard } from './QuestCard/QuestCard';
import { QuestWidget } from './QuestWidget/QuestWidget';
import { StatsWidget } from './StatsWidget/StatsWidget';
import { ResumeBanner } from './ResumeBanner/ResumeBanner';
import './StartScreen.scss';

interface StartScreenProps {
    cameraError: string | null;
    /** Quest to feature as hero card (null = no hero card) */
    featuredQuest?: QuestDef | null;
    /** First active quest for widget preview (may differ from featured) */
    activeQuest?: QuestDef | null;
    questProgress?: QuestProgress;
    userLevel?: number;
    onAcceptQuest?: (questId: string) => void;
    onAbandonQuest?: (questId: string) => void;
    /** When true, auto-open the AuthModal with quest-complete promo banner */
    pendingSignupPrompt?: boolean;
    onSignupPromptHandled?: () => void;
}

export function StartScreen({
    cameraError,
    featuredQuest,
    activeQuest,
    questProgress,
    userLevel,
    onAcceptQuest,
    onAbandonQuest,
    pendingSignupPrompt,
    onSignupPromptHandled,
}: StartScreenProps) {
    const {
        exerciseType, changeExerciseType,
        setGoalReps, setSessionMode,
        handleStart, handleOpenConfig,
        handleResumeWorkout, handleDiscardCheckpoint,
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
        const lifetimeReps = dbUser?.progression.lifetimeReps;
        if (!lifetimeReps) return 0;
        return Object.values(lifetimeReps).reduce<number>((sum, v) => sum + (v ?? 0), 0);
    }, [dbUser]);

    // Tier based on level: bronze / silver / gold / platinum
    const tier = getTier(level);
    const streak = dbUser?.stats.streak ?? 0;

    // Clean up deep link hash after reading it
    useEffect(() => {
        if (isDeepLinkFriends) {
            history.replaceState(null, '', window.location.pathname);
        }
    }, [isDeepLinkFriends]);

    // Auto-open AuthModal with promo banner when guest just completed a quest
    const [prevSignupPrompt, setPrevSignupPrompt] = useState(false);
    if (pendingSignupPrompt && !prevSignupPrompt) {
        setPrevSignupPrompt(true);
        setActiveModal({ type: 'auth', signupPromo: true });
        onSignupPromptHandled?.();
    }
    if (!pendingSignupPrompt && prevSignupPrompt) {
        setPrevSignupPrompt(false);
    }

    // ── Resume interrupted workout ─────────────────────────────────
    const [checkpoint, setCheckpoint] = useState(() => getWorkoutCheckpoint());

    const onResume = useCallback(() => {
        handleResumeWorkout();
        setCheckpoint(null);
    }, [handleResumeWorkout]);

    const onDiscard = useCallback(() => {
        handleDiscardCheckpoint();
        setCheckpoint(null);
    }, [handleDiscardCheckpoint]);

    // Quest state helpers
    const featuredAccepted = featuredQuest && questProgress ? isQuestAccepted(featuredQuest, questProgress) : false;
    const availableQuests = questProgress ? getAvailableQuests(questProgress, userLevel ?? 0) : [];
    const acceptedQuests = questProgress ? getAcceptedQuests(questProgress, userLevel ?? 0) : [];
    const availableCount = availableQuests.length;
    const acceptedCount = acceptedQuests.length;
    const hasAvailableQuests = availableCount > 0;
    const allQuestsCompleted = questProgress && Object.keys(questProgress.completed).length > 0 && !hasAvailableQuests;
    const completedCount = questProgress ? Object.keys(questProgress.completed).length : 0;
    const catMeta = featuredQuest ? QUEST_CATEGORY_META[featuredQuest.category] : null;
    const onboardingDone = !!questProgress?.completed['first_steps'];

    // Accept featured quest handler
    const handleAcceptQuest = useCallback(() => {
        if (featuredQuest && onAcceptQuest) {
            onAcceptQuest(featuredQuest.id);
        }
    }, [featuredQuest, onAcceptQuest]);

    // Start a quest (works for any quick-startable quest)
    const startQuestWorkout = useCallback((quest: QuestDef) => {
        setGoalReps(quest.goal.reps);
        setSessionMode('reps');
        const exercise = quest.goal.exerciseType;
        if (exercise) {
            changeExerciseType(exercise);
        }
        handleStart(exercise);
    }, [setGoalReps, setSessionMode, changeExerciseType, handleStart]);

    const handleFeaturedQuestStart = useCallback(() => {
        if (!featuredQuest) return;
        startQuestWorkout(featuredQuest);
    }, [featuredQuest, startQuestWorkout]);

    // Quest start from QuestsScreen (close modal first)
    const handleQuestStartFromJournal = useCallback((quest: QuestDef) => {
        setActiveModal(null);
        startQuestWorkout(quest);
    }, [startQuestWorkout]);

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
                    level={level}
                    totalXp={totalXp}
                    xpIntoCurrentLevel={xpIntoCurrentLevel}
                    xpNeededForNextLevel={xpNeededForNextLevel}
                    levelProgressPct={levelProgressPct}
                    onOpenProfile={() => setActiveModal({ type: 'profile', initialTab: 'feed' })}
                    onOpenAuth={() => setActiveModal({ type: 'auth' })}
                />

                {/* ── Quest Hero Card (only for featured quest) ── */}
                {featuredQuest && (
                    <QuestCard
                        activeQuest={featuredQuest}
                        questAccepted={!!featuredAccepted}
                        questProgress={questProgress!}
                        catMeta={catMeta}
                        exerciseType={exerciseType}
                        changeExerciseType={changeExerciseType}
                        onAcceptQuest={handleAcceptQuest}
                        onQuestStart={handleFeaturedQuestStart}
                    />
                )}

                {/* ── Quest Widget (always visible when onboarding done) ── */}
                {user && onboardingDone && (
                    <QuestWidget
                        activeQuest={activeQuest}
                        acceptedCount={acceptedCount}
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

                {/* ── Resume interrupted workout ── */}
                {checkpoint && (
                    <ResumeBanner
                        checkpoint={checkpoint}
                        onResume={onResume}
                        onDiscard={onDiscard}
                    />
                )}

                {/* ── Quick Session button ── */}
                {onboardingDone && (
                    <PrimaryCTA
                        variant="solid"
                        size="lg"
                        block
                        icon="⚡"
                        onClick={() => setActiveModal({ type: 'quickSession' })}
                    >
                        Quick Session
                    </PrimaryCTA>
                )}

                {/* ── Multi-Set Workout ── */}
                {onboardingDone && (
                    <PrimaryCTA
                        variant="ghost"
                        size="lg"
                        block
                        icon="🏋️"
                        onClick={handleOpenConfig}
                    >
                        Multi-Set Workout
                    </PrimaryCTA>
                )}
            </div>

            <Suspense fallback={null}>
                {activeModal?.type === 'quickSession' && (
                    <QuickSessionModal onClose={closeModal} />
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
                        onAbandonQuest={onAbandonQuest}
                        onQuestStart={handleQuestStartFromJournal}
                    />
                )}
            </Suspense>
        </div>
    );
}
