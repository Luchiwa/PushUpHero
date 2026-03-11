import { useState } from 'react';
import { useAuth } from '@hooks/useAuth';
import { useSessionHistory } from '@hooks/useSessionHistory';
import { useFriends } from '@hooks/useFriends';
import { SessionHistoryPanel } from '@components/SessionHistoryPanel/SessionHistoryPanel';
import { FriendsTab } from '@components/FriendsTab/FriendsTab';
import { FriendsFeedPanel } from '@components/FriendsFeedPanel/FriendsFeedPanel';
import { SettingsModal } from '@components/SettingsModal/SettingsModal';
import './ProfileModal.scss';

type ProfileTab = 'history' | 'friends' | 'feed';

interface ProfileModalProps {
    onClose: () => void;
}

export function ProfileModal({ onClose }: ProfileModalProps) {
    const { user, dbUser, logout, level, totalLifetimeReps } = useAuth();
    const { getSessions, totalSessionCount } = useSessionHistory();
    const { friends, incomingRequests } = useFriends();
    const sessions = getSessions();

    const [activeTab, setActiveTab] = useState<ProfileTab>('history');
    const [showSettings, setShowSettings] = useState(false);

    const handleLogout = async () => {
        await logout();
        onClose();
    };

    if (!user) return null;

    const memberSince = dbUser?.createdAt
        ? new Date(dbUser.createdAt).toLocaleDateString()
        : new Date(user.metadata.creationTime ?? '').toLocaleDateString();

    return (
        <>
        <div className="profile-fullscreen">
            <div className="profile-topbar">
                <button className="profile-back-btn" onClick={onClose}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>
                <span className="profile-topbar-title">Profile</span>
                <button className="profile-settings-btn" onClick={() => setShowSettings(true)} aria-label="Settings">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                </button>
            </div>

            <div className="profile-content">
                <div className="profile-header">
                    <div className="profile-avatar-large">
                        {dbUser?.displayName?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="profile-info">
                        <h2>{dbUser?.displayName || 'User'}</h2>
                        <span className="profile-member-since">Member since {memberSince}</span>
                    </div>
                </div>

                <div className="profile-stats-grid">
                    <div className="profile-stat-box">
                        <span className="profile-stat-value">{level}</span>
                        <span className="profile-stat-label">Level</span>
                    </div>
                    <div className="profile-stat-box">
                        <span className="profile-stat-value">{totalLifetimeReps}</span>
                        <span className="profile-stat-label">Total Reps</span>
                    </div>
                    <div className="profile-stat-box">
                        <span className="profile-stat-value">{totalSessionCount}</span>
                        <span className="profile-stat-label">Sessions</span>
                    </div>
                </div>

                {/* Tab bar */}
                <div className="profile-tabs">
                    <button
                        className={`profile-tab ${activeTab === 'history' ? 'profile-tab--active' : ''}`}
                        onClick={() => setActiveTab('history')}
                    >
                        History
                    </button>
                    <button
                        className={`profile-tab ${activeTab === 'friends' ? 'profile-tab--active' : ''}`}
                        onClick={() => setActiveTab('friends')}
                    >
                        Friends
                        {incomingRequests.length > 0 && (
                            <span className="profile-tab-badge">{incomingRequests.length}</span>
                        )}
                    </button>
                    <button
                        className={`profile-tab ${activeTab === 'feed' ? 'profile-tab--active' : ''}`}
                        onClick={() => setActiveTab('feed')}
                    >
                        Feed
                        {friends.length > 0 && <span className="profile-tab-dot" />}
                    </button>
                </div>

                {/* Tab content */}
                {activeTab === 'history' && (
                    <div className="profile-tab-panel">
                        {sessions.length > 0
                            ? <SessionHistoryPanel />
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

                <div className="profile-actions">
                    <button className="btn-logout" onClick={handleLogout}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                            <polyline points="16 17 21 12 16 7"></polyline>
                            <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                        Sign Out
                    </button>
                </div>
            </div>
        </div>

        {showSettings && (
            <SettingsModal
                onClose={() => setShowSettings(false)}
                onAccountDeleted={() => { onClose(); }}
            />
        )}
        </>
    );
}
