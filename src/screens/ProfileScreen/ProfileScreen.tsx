/**
 * ProfileScreen — auth-only navigation hub.
 *
 * Replaces ProfileModal. Top: PlayerCard hero (avatar, level, XP, mini
 * stats — verbatim from the modal). Below: HubMenu with a featured
 * Saved Workouts card and 5 navigation items + Settings + Sign out.
 *
 * ProgressionScreen and SettingsModal are rendered inline as overlays
 * (their natural home — they're sub-views of "your profile"). Other
 * destinations (Saved Workouts, Friends, Feed, Stats, Quests) bubble up
 * to StartScreen via callbacks; StartScreen owns the ActiveModal swap.
 *
 * Guest gating happens at the entry point (PlayerHUD only renders the
 * tappable avatar for authenticated users), so an early null-return
 * here is just a guard against impossible states.
 */
import { lazy, Suspense, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageLayout } from '@components/PageLayout/PageLayout';
import { ModalFallback } from '@components/ModalFallback/ModalFallback';
import { useAuthCore } from '@hooks/useAuth';
import { useFriends } from '@hooks/useFriends';
import { useActivityFeed } from '@hooks/useActivityFeed';
import { useSavedWorkouts } from '@hooks/useSavedWorkouts';
import { read, STORAGE_KEY_BUILDERS } from '@infra/storage';
import { PlayerCard } from './PlayerCard/PlayerCard';
import { HubMenu } from './HubMenu/HubMenu';
import './ProfileScreen.scss';

const SettingsModal = lazy(() =>
    import('@modals/SettingsModal/SettingsModal').then(m => ({ default: m.SettingsModal })),
);
const ProgressionScreen = lazy(() =>
    import('@screens/ProgressionScreen/ProgressionScreen').then(m => ({ default: m.ProgressionScreen })),
);

interface ProfileScreenProps {
    onClose: () => void;
    onOpenSavedWorkouts: () => void;
    onOpenFriends: (initialTab: 'friends' | 'feed') => void;
    onOpenStats: () => void;
    onOpenQuests: () => void;
}

export function ProfileScreen({
    onClose,
    onOpenSavedWorkouts,
    onOpenFriends,
    onOpenStats,
    onOpenQuests,
}: ProfileScreenProps) {
    const { t } = useTranslation('profile');
    const { user, logout } = useAuthCore();
    const { friends, incomingRequests } = useFriends();
    const { feed } = useActivityFeed(friends);
    const { workouts } = useSavedWorkouts(user?.uid);

    const [showSettings, setShowSettings] = useState(false);
    const [showProgression, setShowProgression] = useState(false);

    const lastSeen = user ? read<number>(STORAGE_KEY_BUILDERS.feedLastSeen(user.uid), 0) : 0;
    const latestEventAt = feed.length > 0 ? feed[0].createdAt : 0;
    const hasFeedUnread = friends.length > 0 && latestEventAt > lastSeen;

    const handleSignOut = useCallback(() => {
        void logout();
    }, [logout]);

    if (!user) return null;

    return (
        <>
            <PageLayout
                title={t('title')}
                onClose={onClose}
                zIndex={200}
                transition="slide"
                bodyClassName="profile-body"
            >
                <PlayerCard onProgressionOpen={() => setShowProgression(true)} />
                <HubMenu
                    savedWorkoutsCount={workouts.length}
                    pendingFriendRequests={incomingRequests.length}
                    hasFeedUnread={hasFeedUnread}
                    onOpenSavedWorkouts={onOpenSavedWorkouts}
                    onOpenFriends={() => onOpenFriends('friends')}
                    onOpenFeed={() => onOpenFriends('feed')}
                    onOpenStats={onOpenStats}
                    onOpenQuests={onOpenQuests}
                    onOpenAchievements={() => setShowProgression(true)}
                    onOpenSettings={() => setShowSettings(true)}
                    onSignOut={handleSignOut}
                />
            </PageLayout>

            <Suspense fallback={<ModalFallback />}>
                {showSettings && (
                    <SettingsModal
                        onClose={() => setShowSettings(false)}
                        onAccountDeleted={onClose}
                    />
                )}
                {showProgression && (
                    <ProgressionScreen onClose={() => setShowProgression(false)} />
                )}
            </Suspense>
        </>
    );
}
