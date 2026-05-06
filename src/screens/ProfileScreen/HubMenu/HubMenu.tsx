/**
 * HubMenu — vertical list of navigation items rendered below the
 * PlayerCard hero. Six uniform cards: Saved Workouts, Friends, Activity
 * Feed, Stats, Quests, Achievements.
 *
 * Settings opens from the topbar gear (ProfileScreen rightAction), and
 * sign-out lives only inside SettingsModal — neither belongs in the hub.
 */
import { useTranslation } from 'react-i18next';
import { HubMenuItem } from '../HubMenuItem/HubMenuItem';
import './HubMenu.scss';

interface HubMenuProps {
    pendingFriendRequests: number;
    hasFeedUnread: boolean;
    onOpenSavedWorkouts: () => void;
    onOpenFriends: () => void;
    onOpenStats: () => void;
    onOpenQuests: () => void;
    onOpenAchievements: () => void;
}

export function HubMenu({
    pendingFriendRequests,
    hasFeedUnread,
    onOpenSavedWorkouts,
    onOpenFriends,
    onOpenStats,
    onOpenQuests,
    onOpenAchievements,
}: HubMenuProps) {
    const { t } = useTranslation('profile');

    // Pending requests are actionable — surface them first in the SR label.
    // Fall back to "new activity" only when there's no incoming request.
    let socialAriaLabel: string | undefined;
    if (pendingFriendRequests > 0) {
        socialAriaLabel = t('hub.social_aria_with_pending', { count: pendingFriendRequests });
    } else if (hasFeedUnread) {
        socialAriaLabel = t('hub.social_aria_unread');
    }

    return (
        <nav className="hub-menu" aria-label={t('title')}>
            {/* Saved Workouts — bookmark icon, ember (primary) */}
            <HubMenuItem
                iconColor="ember"
                label={t('hub.saved_workouts')}
                ariaLabel={t('hub.saved_workouts_aria')}
                onClick={onOpenSavedWorkouts}
                icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                    </svg>
                }
            />

            {/* Social — friends list + activity feed in a single entry */}
            <HubMenuItem
                iconColor="ember"
                label={t('hub.social')}
                badge={pendingFriendRequests}
                dot={hasFeedUnread}
                ariaLabel={socialAriaLabel}
                onClick={onOpenFriends}
                icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                }
            />

            {/* Stats */}
            <HubMenuItem
                iconColor="ember"
                label={t('hub.stats')}
                onClick={onOpenStats}
                icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="20" x2="18" y2="10" />
                        <line x1="12" y1="20" x2="12" y2="4" />
                        <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                }
            />

            {/* Quests — gold (reward) */}
            <HubMenuItem
                iconColor="gold"
                label={t('hub.quests')}
                onClick={onOpenQuests}
                icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2L15 8l7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" />
                    </svg>
                }
            />

            {/* Achievements / Progression — gold (reward) */}
            <HubMenuItem
                iconColor="gold"
                label={t('hub.achievements')}
                onClick={onOpenAchievements}
                icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                        <path d="M4 22h16" />
                        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                    </svg>
                }
            />
        </nav>
    );
}
