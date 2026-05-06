import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthCore, useLevel, useSessions } from '@hooks/useAuth';
import { InstallBanner } from '@overlays/InstallBanner/InstallBanner';
import { PrimaryCTA } from '@components/PrimaryCTA/PrimaryCTA';
import { ModalFallback } from '@components/ModalFallback/ModalFallback';

// Lazy-loaded modals/screens (only parsed when opened)
const AuthModal = lazy(() => import('@modals/AuthModal/AuthModal').then(m => ({ default: m.AuthModal })));
const ProfileScreen = lazy(() => import('@screens/ProfileScreen/ProfileScreen').then(m => ({ default: m.ProfileScreen })));
const SocialScreen = lazy(() => import('@screens/SocialScreen/SocialScreen').then(m => ({ default: m.SocialScreen })));
const SavedWorkoutsScreen = lazy(() => import('@screens/SavedWorkoutsScreen/SavedWorkoutsScreen').then(m => ({ default: m.SavedWorkoutsScreen })));
const QuickSessionModal = lazy(() => import('@modals/QuickSessionModal/QuickSessionModal').then(m => ({ default: m.QuickSessionModal })));
const StatsScreen = lazy(() => import('@screens/StatsScreen/StatsScreen').then(m => ({ default: m.StatsScreen })));
const QuestsScreen = lazy(() => import('@screens/QuestsScreen/QuestsScreen').then(m => ({ default: m.QuestsScreen })));
import { useWorkout } from '@app/WorkoutContext';
import { QUEST_CATEGORY_META, getAcceptedQuests, getAvailableQuests, getTier, isQuestAccepted, type QuestDef, type QuestProgress } from '@domain';
import type { WorkoutPlan } from '@exercises/types';
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
    const { t } = useTranslation('start');
    const {
        exerciseType, changeExerciseType,
        setGoalReps, setSessionMode, setWorkoutPlan,
        handleStart, handleOpenConfig,
        handleResumeWorkout, handleDiscardCheckpoint,
    } = useWorkout();
    const { user, dbUser } = useAuthCore();
    const { level, totalXp, xpIntoCurrentLevel, xpNeededForNextLevel, levelProgressPct } = useLevel();
    const { totalSessionCount } = useSessions();

    // ── Modal navigation stack ──────────────────────────────────────
    // Each push opens a screen on top; closeModal pops one level. The stack
    // IS the history — no `from?` field, no special-case routing logic.
    // Parent levels stay mounted under the top so back navigation just
    // unmounts the child and reveals what's underneath, no flash.
    type ActiveModal =
        | { type: 'auth'; signupPromo?: boolean }
        | { type: 'profileScreen' }
        | { type: 'socialScreen'; initialTab: 'friends' | 'feed' }
        | { type: 'savedWorkouts' }
        | { type: 'quests' }
        | { type: 'quickSession' }
        | { type: 'stats' };

    const isDeepLinkFriends = window.location.hash === '#friends';
    const [modalStack, setModalStack] = useState<ActiveModal[]>(
        isDeepLinkFriends ? [{ type: 'socialScreen', initialTab: 'friends' }] : [],
    );

    const pushModal = useCallback((modal: ActiveModal) => {
        setModalStack(s => [...s, modal]);
    }, []);

    const closeModal = useCallback(() => {
        setModalStack(s => s.slice(0, -1));
    }, []);

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
        pushModal({ type: 'auth', signupPromo: true });
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

    // Quest start from QuestsScreen — clear the entire modal stack (the
    // user is leaving the hub arborescence to enter the workout flow).
    const handleQuestStartFromJournal = useCallback((quest: QuestDef) => {
        setModalStack([]);
        startQuestWorkout(quest);
    }, [startQuestWorkout]);

    // Saved-workout pick: load plan + navigate to config; clear the stack.
    const handleSavedWorkoutPick = useCallback((plan: WorkoutPlan) => {
        setWorkoutPlan(plan);
        setModalStack([]);
        handleOpenConfig();
    }, [setWorkoutPlan, handleOpenConfig]);

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
                    onOpenProfile={() => pushModal({ type: 'profileScreen' })}
                    onOpenAuth={() => pushModal({ type: 'auth' })}
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
                        onOpen={() => pushModal({ type: 'quests' })}
                    />
                )}

                {/* ── Stats Widget (logged-in only) ── */}
                {user && dbUser && totalSessionCount > 0 && (
                    <StatsWidget
                        streak={streak}
                        totalLifetimeReps={totalLifetimeReps}
                        totalSessionCount={totalSessionCount}
                        onOpen={() => pushModal({ type: 'stats' })}
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
                        onClick={() => pushModal({ type: 'quickSession' })}
                    >
                        {t('cta.quick_session')}
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
                        {t('cta.multi_set_workout')}
                    </PrimaryCTA>
                )}
            </div>

            <Suspense fallback={<ModalFallback />}>
                {/* JSX source order = stack rendering order. Parent levels
                    sit below their children via DOM order at the same
                    z-index, so back navigation reveals them without flash.
                    For modals carrying props (initialTab, signupPromo),
                    we look up the entry from the stack via .find(). */}

                {modalStack.some(m => m.type === 'profileScreen') && (
                    <ProfileScreen
                        onClose={closeModal}
                        onOpenSavedWorkouts={() => pushModal({ type: 'savedWorkouts' })}
                        onOpenFriends={() => pushModal({ type: 'socialScreen', initialTab: 'friends' })}
                        onOpenStats={() => pushModal({ type: 'stats' })}
                        onOpenQuests={() => pushModal({ type: 'quests' })}
                    />
                )}

                {(() => {
                    const m = modalStack.find(x => x.type === 'socialScreen');
                    return m ? <SocialScreen onClose={closeModal} initialTab={m.initialTab} /> : null;
                })()}

                {modalStack.some(m => m.type === 'savedWorkouts') && user && (
                    <SavedWorkoutsScreen
                        uid={user.uid}
                        onClose={closeModal}
                        onPick={handleSavedWorkoutPick}
                    />
                )}

                {modalStack.some(m => m.type === 'stats') && (
                    <StatsScreen onClose={closeModal} />
                )}

                {modalStack.some(m => m.type === 'quests') && questProgress != null && (
                    <QuestsScreen
                        onClose={closeModal}
                        questProgress={questProgress}
                        userLevel={userLevel ?? 0}
                        onAcceptQuest={onAcceptQuest}
                        onAbandonQuest={onAbandonQuest}
                        onQuestStart={handleQuestStartFromJournal}
                    />
                )}

                {modalStack.some(m => m.type === 'quickSession') && (
                    <QuickSessionModal onClose={closeModal} />
                )}

                {(() => {
                    const m = modalStack.find(x => x.type === 'auth');
                    return m ? (
                        <AuthModal
                            onClose={closeModal}
                            initialMode={m.signupPromo ? 'register' : undefined}
                            promoBanner={
                                m.signupPromo
                                    ? (
                                        <>
                                            <p className="auth-promo-title">
                                                <span>🎉</span> {t('signup_promo.title')}
                                            </p>
                                            <ul className="auth-promo-perks">
                                                <li className="auth-promo-perk">
                                                    <span className="perk-icon">💾</span>
                                                    {t('signup_promo.perk_save')}
                                                </li>
                                                <li className="auth-promo-perk">
                                                    <span className="perk-icon">🏆</span>
                                                    {t('signup_promo.perk_unlock')}
                                                </li>
                                                <li className="auth-promo-perk">
                                                    <span className="perk-icon">📈</span>
                                                    {t('signup_promo.perk_track')}
                                                </li>
                                            </ul>
                                        </>
                                    )
                                    : undefined
                            }
                        />
                    ) : null;
                })()}
            </Suspense>
        </div>
    );
}
