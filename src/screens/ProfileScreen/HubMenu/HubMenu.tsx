/**
 * HubMenu — vertical list of navigation items rendered below the
 * PlayerCard hero. The first item is a "featured" Saved Workouts card
 * with hero treatment (ember blade, larger icon, mono kicker count) —
 * inline because the visual is one-off, not reusable.
 *
 * All callbacks come from ProfileScreen which owns the actual navigation
 * (lazy-loads sub-screens, opens SettingsModal, signs out).
 */
import { useTranslation } from 'react-i18next';
import { Button } from '@components/Button/Button';
import { HubMenuItem } from '../HubMenuItem/HubMenuItem';
import './HubMenu.scss';

interface HubMenuProps {
    savedWorkoutsCount: number;
    pendingFriendRequests: number;
    hasFeedUnread: boolean;
    onOpenSavedWorkouts: () => void;
    onOpenFriends: () => void;
    onOpenFeed: () => void;
    onOpenStats: () => void;
    onOpenQuests: () => void;
    onOpenAchievements: () => void;
    onOpenSettings: () => void;
    onSignOut: () => void;
}

export function HubMenu({
    savedWorkoutsCount,
    pendingFriendRequests,
    hasFeedUnread,
    onOpenSavedWorkouts,
    onOpenFriends,
    onOpenFeed,
    onOpenStats,
    onOpenQuests,
    onOpenAchievements,
    onOpenSettings,
    onSignOut,
}: HubMenuProps) {
    const { t } = useTranslation('profile');

    const friendsAriaLabel = pendingFriendRequests > 0
        ? t('hub.friends_aria_with_pending', { count: pendingFriendRequests })
        : undefined;

    const feedAriaLabel = hasFeedUnread ? t('hub.feed_aria_unread') : undefined;

    return (
        <nav className="hub-menu" aria-label={t('title')}>
            {/* Featured: Saved Workouts (Operator's Briefing treatment) */}
            <button
                type="button"
                className="hub-featured"
                onClick={onOpenSavedWorkouts}
                aria-label={t('hub.saved_workouts_aria')}
                data-stamp={t('hub.featured_stamp')}
            >
                <span className="hub-featured-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6.5 6.5L17.5 17.5" />
                        <rect x="2" y="9" width="4" height="6" rx="1" />
                        <rect x="18" y="9" width="4" height="6" rx="1" />
                        <rect x="6" y="10" width="2" height="4" rx="0.5" />
                        <rect x="16" y="10" width="2" height="4" rx="0.5" />
                    </svg>
                </span>
                <span className="hub-featured-text">
                    <span className="hub-featured-kicker">{t('hub.saved_workouts_count', { count: savedWorkoutsCount })}</span>
                    <span className="hub-featured-title">{t('hub.saved_workouts')}</span>
                </span>
                <svg className="hub-featured-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6" />
                </svg>
            </button>

            {/* Friends */}
            <HubMenuItem
                iconColor="ember"
                label={t('hub.friends')}
                badge={pendingFriendRequests}
                ariaLabel={friendsAriaLabel}
                onClick={onOpenFriends}
                icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                }
            />

            {/* Activity Feed */}
            <HubMenuItem
                iconColor="ember"
                label={t('hub.feed')}
                dot={hasFeedUnread}
                ariaLabel={feedAriaLabel}
                onClick={onOpenFeed}
                icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
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

            <hr className="hub-divider" />

            {/* Settings — dim (system) */}
            <HubMenuItem
                iconColor="dim"
                label={t('hub.settings')}
                onClick={onOpenSettings}
                icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                }
            />

            {/* Sign out — Arena Button, danger variant */}
            <Button
                variant="danger"
                size="md"
                onClick={onSignOut}
                icon={
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                }
            >
                {t('hub.signout')}
            </Button>
        </nav>
    );
}
