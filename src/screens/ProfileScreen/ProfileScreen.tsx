/**
 * ProfileScreen — auth-only navigation hub.
 *
 * Top: PlayerCard hero (avatar, level, XP, mini stats). Topbar right slot
 * holds the gear that opens SettingsModal. Below: HubMenu with a featured
 * Saved Workouts card and standard nav items.
 *
 * ProgressionScreen and SettingsModal are rendered inline as overlays —
 * they're sub-views of "your profile". Other destinations (Saved Workouts,
 * Friends, Feed, Stats, Quests) bubble up via callbacks; the host owns
 * the ActiveModal swap so the back button returns to the home screen.
 *
 * Guest gating happens at the entry point (PlayerHUD only renders the
 * tappable avatar for authenticated users); the early null-return below
 * is just a guard against impossible states.
 */
import { lazy, Suspense, useState } from 'react';
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
    const { user } = useAuthCore();
    const { friends, incomingRequests } = useFriends();
    const { feed } = useActivityFeed(friends);
    const { workouts } = useSavedWorkouts(user?.uid);

    const [showSettings, setShowSettings] = useState(false);
    const [showProgression, setShowProgression] = useState(false);

    const lastSeen = user ? read<number>(STORAGE_KEY_BUILDERS.feedLastSeen(user.uid), 0) : 0;
    const latestEventAt = feed.length > 0 ? feed[0].createdAt : 0;
    const hasFeedUnread = friends.length > 0 && latestEventAt > lastSeen;

    if (!user) return null;

    return (
        <>
            <PageLayout
                title={t('title')}
                onClose={onClose}
                zIndex={200}
                transition="slide"
                bodyClassName="profile-body"
                rightAction={
                    <button
                        type="button"
                        className="profile-settings-btn btn-icon"
                        onClick={() => setShowSettings(true)}
                        aria-label={t('settings_aria')}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                    </button>
                }
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
