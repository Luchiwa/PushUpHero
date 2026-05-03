/**
 * FriendsScreen — Two-tab screen for friends list + activity feed.
 *
 * Tabs are an internal user toggle (not a workflow transition), so no
 * live region. Marking the feed as "seen" is owned here — the hub menu
 * dot in ProfileScreen reads the same storage key to decide whether to
 * surface unread activity.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageLayout } from '@components/PageLayout/PageLayout';
import { useAuthCore } from '@hooks/useAuth';
import { useFriends } from '@hooks/useFriends';
import { write, STORAGE_KEY_BUILDERS } from '@infra/storage';
import { FriendsTab } from './FriendsTab/FriendsTab';
import { FriendsFeedPanel } from './FriendsFeedPanel/FriendsFeedPanel';
import './FriendsScreen.scss';

export type FriendsTabKey = 'friends' | 'feed';

interface FriendsScreenProps {
    onClose: () => void;
    initialTab?: FriendsTabKey;
}

export function FriendsScreen({ onClose, initialTab = 'friends' }: FriendsScreenProps) {
    const { t } = useTranslation('friends');
    const { user } = useAuthCore();
    const { friends } = useFriends();
    const [activeTab, setActiveTab] = useState<FriendsTabKey>(initialTab);

    useEffect(() => {
        // Depend on uid (stable) rather than the whole user object — dbUser
        // updates upstream re-identify `user` and would otherwise re-fire the
        // write on the same tab visit.
        if (activeTab !== 'feed' || !user) return;
        write(STORAGE_KEY_BUILDERS.feedLastSeen(user.uid), Date.now());
    }, [activeTab, user]);

    return (
        <PageLayout
            title={t('title')}
            onClose={onClose}
            zIndex={200}
            transition="slide"
            bodyClassName="friends-body"
        >
            <div className="friends-tabs" role="tablist">
                <button
                    type="button"
                    role="tab"
                    id="friends-tab-friends"
                    aria-selected={activeTab === 'friends'}
                    aria-controls="friends-panel-friends"
                    tabIndex={activeTab === 'friends' ? 0 : -1}
                    className={`friends-tab ${activeTab === 'friends' ? 'friends-tab--active' : ''}`}
                    onClick={() => setActiveTab('friends')}
                >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    <span>{t('tab_friends')}</span>
                </button>
                <button
                    type="button"
                    role="tab"
                    id="friends-tab-feed"
                    aria-selected={activeTab === 'feed'}
                    aria-controls="friends-panel-feed"
                    tabIndex={activeTab === 'feed' ? 0 : -1}
                    className={`friends-tab ${activeTab === 'feed' ? 'friends-tab--active' : ''}`}
                    onClick={() => setActiveTab('feed')}
                >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    <span>{t('tab_feed')}</span>
                </button>
                <div
                    className="friends-tabs-indicator"
                    style={{ left: activeTab === 'friends' ? '4px' : 'calc(50% + 2px)' }}
                />
            </div>

            {activeTab === 'friends' && (
                <div
                    id="friends-panel-friends"
                    className="friends-tab-panel"
                    role="tabpanel"
                    aria-labelledby="friends-tab-friends"
                >
                    <FriendsTab />
                </div>
            )}
            {activeTab === 'feed' && (
                <div
                    id="friends-panel-feed"
                    className="friends-tab-panel"
                    role="tabpanel"
                    aria-labelledby="friends-tab-feed"
                >
                    <FriendsFeedPanel friends={friends} />
                </div>
            )}
        </PageLayout>
    );
}
