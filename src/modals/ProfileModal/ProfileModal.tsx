import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@hooks/useAuth';
import { Avatar } from '@components/Avatar/Avatar';
import { useSessionHistory } from '@hooks/useSessionHistory';
import { useFriends } from '@hooks/useFriends';
import { useActivityFeed } from '@hooks/useActivityFeed';
import { SessionHistoryPanel } from '@modals/panels/SessionHistoryPanel/SessionHistoryPanel';
import { FriendsTab } from '@modals/panels/FriendsTab/FriendsTab';
import { FriendsFeedPanel } from '@modals/panels/FriendsFeedPanel/FriendsFeedPanel';
import { SettingsModal } from '@modals/SettingsModal/SettingsModal';
import { StatsScreen } from '@screens/StatsScreen/StatsScreen';
import { ProgressionScreen } from '@screens/ProgressionScreen/ProgressionScreen';
import { PageLayout } from '@components/PageLayout/PageLayout';
import './ProfileModal.scss';

type ProfileTab = 'history' | 'friends' | 'feed';

interface ProfileModalProps {
    onClose: () => void;
    initialTab?: ProfileTab;
}

export function ProfileModal({ onClose, initialTab }: ProfileModalProps) {
    const { user, dbUser, level, totalXp, uploadAvatar } = useAuth();
    const { sessions, totalSessionCount } = useSessionHistory();
    const { friends, incomingRequests } = useFriends();

    const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab ?? 'history');
    const [showSettings, setShowSettings] = useState(false);
    const [showStats, setShowStats] = useState(false);
    const [showProgression, setShowProgression] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAvatarClick = () => fileInputRef.current?.click();
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try { await uploadAvatar(file); } finally { setUploading(false); e.target.value = ''; }
    };

    const FEED_SEEN_KEY = `feed_last_seen_${user?.uid}`;
    const [lastSeen, setLastSeen] = useState<number>(
        () => parseInt(localStorage.getItem(`feed_last_seen_${user?.uid}`) ?? '0', 10)
    );
    const { feed } = useActivityFeed(friends);
    const latestEventAt = feed.length > 0 ? feed[0].createdAt : 0;
    const hasFeedUnread = friends.length > 0 && latestEventAt > lastSeen;

    const markFeedSeen = useCallback(() => {
        const now = Date.now();
        localStorage.setItem(FEED_SEEN_KEY, String(now));
        setLastSeen(now);
    }, [FEED_SEEN_KEY]);

    useEffect(() => {
        if (activeTab === 'feed') markFeedSeen();
    }, [activeTab, markFeedSeen]);

    if (!user) return null;

    const memberSince = dbUser?.createdAt
        ? new Date(dbUser.createdAt).toLocaleDateString()
        : new Date(user.metadata.creationTime ?? '').toLocaleDateString();

    return (
        <>
        <PageLayout
            title="Profile"
            onClose={onClose}
            rightAction={
                <button type="button" className="btn-icon profile-settings-btn" onClick={() => setShowSettings(true)} aria-label="Settings">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                </button>
            }
            bodyClassName="profile-content"
        >
                <div className="profile-header">
                    <div className={`profile-avatar-wrapper ${uploading ? 'profile-avatar-wrapper--uploading' : ''}`}>
                        <Avatar
                            photoURL={dbUser?.photoURL}
                            initials={dbUser?.displayName || 'U'}
                            size={72}
                            onClick={handleAvatarClick}
                        />
                        <span className="profile-avatar-edit-hint">✎</span>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleFileChange}
                    />
                    <div className="profile-info">
                        <h2>
                            {dbUser?.displayName || 'User'}
                            {(dbUser?.streak ?? 0) > 0 && (
                                <>
                                    <span className="profile-streak-sep">·</span>
                                    <span className="profile-streak">{dbUser?.streak} 🔥 Streak</span>
                                </>
                            )}
                        </h2>
                        <span className="profile-member-since">Member since {memberSince}</span>
                    </div>
                </div>

                <div className="profile-stats-grid">
                    <div className="profile-stat-box">
                        <span className="profile-stat-value">{level}</span>
                        <span className="profile-stat-label">Level</span>
                    </div>
                    <div className="profile-stat-box">
                        <span className="profile-stat-value">{totalXp.toLocaleString()}</span>
                        <span className="profile-stat-label">Total XP</span>
                    </div>
                    <div className="profile-stat-box">
                        <span className="profile-stat-value">{totalSessionCount}</span>
                        <span className="profile-stat-label">Sessions</span>
                    </div>
                </div>

                <button
                    type="button"
                    className="profile-progression-btn"
                    onClick={() => setShowProgression(true)}
                >
                    🏆 Progression
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                </button>

                {/* Tab bar */}
                <div className="profile-tabs">
                    <button
                        type="button"
                        className={`profile-tab ${activeTab === 'history' ? 'profile-tab--active' : ''}`}
                        onClick={() => setActiveTab('history')}
                    >
                        History
                    </button>
                    <button
                        type="button"
                        className={`profile-tab ${activeTab === 'friends' ? 'profile-tab--active' : ''}`}
                        onClick={() => setActiveTab('friends')}
                    >
                        Friends
                        {incomingRequests.length > 0 && (
                            <span className="profile-tab-badge">{incomingRequests.length}</span>
                        )}
                    </button>
                    <button
                        type="button"
                        className={`profile-tab ${activeTab === 'feed' ? 'profile-tab--active' : ''}`}
                        onClick={() => setActiveTab('feed')}
                    >
                        Feed
                        {hasFeedUnread && <span className="profile-tab-dot" />}
                    </button>
                </div>

                {/* Tab content */}
                {activeTab === 'history' && (
                    <div className="profile-tab-panel">
                        {sessions.length > 0
                            ? <SessionHistoryPanel onViewAll={() => setShowStats(true)} />
                            : <p className="friends-empty-msg">No sessions yet. Start your first workout!</p>
                        }
                    </div>
                )}
                {activeTab === 'friends' && (
                    <div className="profile-tab-panel">
                        <FriendsTab />
                    </div>
                )}
                {activeTab === 'feed' && (
                    <div className="profile-tab-panel">
                        <FriendsFeedPanel friends={friends} />
                    </div>
                )}
        </PageLayout>

        {showSettings && (
            <SettingsModal
                onClose={() => setShowSettings(false)}
                onAccountDeleted={() => { onClose(); }}
            />
        )}
        {showStats && (
            <StatsScreen onClose={() => setShowStats(false)} />
        )}
        {showProgression && (
            <ProgressionScreen onClose={() => setShowProgression(false)} />
        )}
        </>
    );
}
