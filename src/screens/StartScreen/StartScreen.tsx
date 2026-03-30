import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthCore, useLevel } from '@hooks/useAuth';
import { useSessions } from '@hooks/useAuth';
import { AuthModal } from '@modals/AuthModal/AuthModal';
import { ProfileModal } from '@modals/ProfileModal/ProfileModal';
import { QuickSessionModal } from '@modals/QuickSessionModal/QuickSessionModal';
import { StatsScreen } from '@screens/StatsScreen/StatsScreen';
import { InstallBanner } from '@overlays/InstallBanner/InstallBanner';
import { QuestsScreen } from '@screens/QuestsScreen/QuestsScreen';
import { useWorkout } from '@app/WorkoutContext';
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
}

export function StartScreen({
    isModelReady,
    cameraError,
    activeQuest,
    questProgress,
    userLevel,
    onAcceptQuest,
}: StartScreenProps) {
    const {
        exerciseType, changeExerciseType,
        setGoalReps, setSessionMode,
        handleStart, handleOpenConfig,
    } = useWorkout();
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
                    onOpenProfile={() => setShowProfileModal(true)}
                    onOpenAuth={() => setShowAuthModal(true)}
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
                        onOpen={() => setShowQuestsScreen(true)}
                    />
                )}

                {/* ── Stats Widget (logged-in only) ── */}
                {user && dbUser && totalSessionCount > 0 && (
                    <StatsWidget
                        streak={streak}
                        totalLifetimeReps={totalLifetimeReps}
                        totalSessionCount={totalSessionCount}
                        onOpen={() => setShowStats(true)}
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
                    <button type="button" className="btn-quick-session" onClick={() => setShowQuickSession(true)} disabled={!isReady}>
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

            {showQuickSession && (
                <QuickSessionModal
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
