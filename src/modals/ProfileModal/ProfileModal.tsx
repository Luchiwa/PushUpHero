import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthCore, useLevel } from '@hooks/useAuth';
import { getTier } from '@domain';
import { Avatar } from '@components/Avatar/Avatar';
import { useSessionHistory } from '@hooks/useSessionHistory';
import { useFriends } from '@hooks/useFriends';
import { useActivityFeed } from '@hooks/useActivityFeed';
import { FriendsTab } from '@modals/panels/FriendsTab/FriendsTab';
import { FriendsFeedPanel } from '@modals/panels/FriendsFeedPanel/FriendsFeedPanel';
import { SettingsModal } from '@modals/SettingsModal/SettingsModal';
import { ProgressionScreen } from '@screens/ProgressionScreen/ProgressionScreen';
import { PageLayout } from '@components/PageLayout/PageLayout';
import { useFocusTrap } from '@hooks/shared/useFocusTrap';
import { read, write, STORAGE_KEY_BUILDERS } from '@infra/storage';
import './ProfileModal.scss';

type ProfileTab = 'friends' | 'feed';

interface ProfileModalProps {
    onClose: () => void;
    initialTab?: ProfileTab;
}

export function ProfileModal({ onClose, initialTab }: ProfileModalProps) {
    const { t } = useTranslation('modals');
    const { user, dbUser, uploadAvatar } = useAuthCore();
    const { level, totalXp, xpIntoCurrentLevel, xpNeededForNextLevel, levelProgressPct } = useLevel();
    const { totalSessionCount } = useSessionHistory();
    const { friends, incomingRequests } = useFriends();

    const tier = getTier(level);
    const streak = dbUser?.stats.streak ?? 0;

    // XP bar: 14 segments (Arena spec)
    const XP_SEGS = useMemo(() => Array.from({ length: 14 }, (_, i) => i), []);
    const filledSegments = Math.round((levelProgressPct / 100) * XP_SEGS.length);

    const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab ?? 'friends');
    const [showSettings, setShowSettings] = useState(false);
    const [showProgression, setShowProgression] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    useFocusTrap(modalRef);

    const handleAvatarClick = () => fileInputRef.current?.click();
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try { await uploadAvatar(file); } finally { setUploading(false); e.target.value = ''; }
    };

    const [lastSeen, setLastSeen] = useState<number>(
        () => user ? read(STORAGE_KEY_BUILDERS.feedLastSeen(user.uid), 0) : 0,
    );
    const { feed } = useActivityFeed(friends);
    const latestEventAt = feed.length > 0 ? feed[0].createdAt : 0;
    const hasFeedUnread = friends.length > 0 && latestEventAt > lastSeen;

    const markFeedSeen = useCallback(() => {
        if (!user) return;
        const now = Date.now();
        write(STORAGE_KEY_BUILDERS.feedLastSeen(user.uid), now);
        setLastSeen(now);
    }, [user]);

    useEffect(() => {
        if (activeTab === 'feed') markFeedSeen();
    }, [activeTab, markFeedSeen]);

    if (!user) return null;

    const memberSince = dbUser?.profile.createdAt
        ? new Date(dbUser.profile.createdAt).toLocaleDateString()
        : '';

    return (
        <>
        <div ref={modalRef}>
        <PageLayout
            title={t('profile.title')}
            onClose={onClose}
            rightAction={
                <button type="button" className="btn-icon profile-settings-btn" onClick={() => setShowSettings(true)} aria-label={t('profile.settings_aria')}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                </button>
            }
            bodyClassName="profile-content"
        >
                {/* ── Player Card ── */}
                <div className={`player-card tier-${tier}`}>
                    <div className="player-card-shine" />

                    {/* Avatar with tier ring */}
                    <div className={`player-card-avatar ${uploading ? 'player-card-avatar--uploading' : ''}`}>
                        <svg className="player-card-ring" viewBox="0 0 96 96" width="88" height="88">
                            <circle className="player-card-ring-track" cx="48" cy="48" r="44" />
                            <circle className="player-card-ring-fill" cx="48" cy="48" r="44"
                                strokeDasharray={`${(levelProgressPct / 100) * 276.5} 276.5`} />
                        </svg>
                        <Avatar
                            photoURL={dbUser?.profile.photoURL}
                            photoThumb={dbUser?.profile.photoThumb}
                            initials={dbUser?.profile.displayName || 'U'}
                            size={68}
                            onClick={handleAvatarClick}
                        />
                        <span className="player-card-edit-hint">✎</span>
                        <span className={`player-card-level tier-${tier}`}>LV{level}</span>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleFileChange}
                    />

                    {/* Name + streak */}
                    <div className="player-card-identity">
                        <h2 className="player-card-name">{dbUser?.profile.displayName || t('profile.default_user_name')}</h2>
                        {streak > 0 && (
                            <span className={`player-card-streak${streak >= 7 ? ' on-fire' : ''}`}>
                                {streak}<span className="player-card-streak-icon">🔥</span>
                            </span>
                        )}
                    </div>
                    <span className="player-card-since">{t('profile.member_since', { date: memberSince })}</span>

                    {/* XP bar — tappable → opens Progression */}
                    <button type="button" className="player-card-xp-btn" onClick={() => setShowProgression(true)}>
                        <div className="player-card-xp-bar" role="progressbar" aria-valuenow={xpIntoCurrentLevel} aria-valuemax={xpNeededForNextLevel}>
                            {XP_SEGS.map((i) => (
                                <div
                                    key={i}
                                    className={`player-card-xp-seg${i < filledSegments ? ' filled' : ''}${i === filledSegments - 1 && filledSegments > 0 ? ' tip' : ''}`}
                                    style={{ animationDelay: `${i * 60}ms` }}
                                />
                            ))}
                        </div>
                        <div className="player-card-xp-label">
                            <span>{xpIntoCurrentLevel.toLocaleString()} XP</span>
                            <span className="player-card-xp-next">{t('profile.xp_label_next', { level: level + 1, remaining: (xpNeededForNextLevel - xpIntoCurrentLevel).toLocaleString() })}</span>
                        </div>
                        <div className="player-card-xp-cta">
                            <span>🏆</span>
                            <span>{t('profile.progression_cta')}</span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                        </div>
                    </button>

                    {/* Stat mini-cards */}
                    <div className="player-card-stats">
                        <div className="player-card-stat">
                            <svg className="player-card-stat-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                            </svg>
                            <span className="player-card-stat-val">{totalXp.toLocaleString()}</span>
                            <span className="player-card-stat-lbl">{t('profile.stat_total_xp')}</span>
                        </div>
                        <div className="player-card-stat">
                            <svg className="player-card-stat-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                            <span className="player-card-stat-val">{totalSessionCount}</span>
                            <span className="player-card-stat-lbl">{t('profile.stat_sessions')}</span>
                        </div>
                        <div className="player-card-stat">
                            <svg className="player-card-stat-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                            <span className="player-card-stat-val">{friends.length}</span>
                            <span className="player-card-stat-lbl">{t('profile.stat_friends')}</span>
                        </div>
                    </div>
                </div>

                {/* Tab bar */}
                <div className="profile-tabs">
                    <button
                        type="button"
                        className={`profile-tab ${activeTab === 'friends' ? 'profile-tab--active' : ''}`}
                        onClick={() => setActiveTab('friends')}
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        <span>{t('profile.tab_friends')}</span>
                        {incomingRequests.length > 0 && (
                            <span className="profile-tab-badge">{incomingRequests.length}</span>
                        )}
                    </button>
                    <button
                        type="button"
                        className={`profile-tab ${activeTab === 'feed' ? 'profile-tab--active' : ''}`}
                        onClick={() => setActiveTab('feed')}
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                        </svg>
                        <span>{t('profile.tab_feed')}</span>
                        {hasFeedUnread && <span className="profile-tab-dot" />}
                    </button>
                    <div className="profile-tabs-indicator" style={{ left: activeTab === 'friends' ? '4px' : 'calc(50% + 2px)' }} />
                </div>

                {/* Tab content */}
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
        </div>

        {showSettings && (
            <SettingsModal
                onClose={() => setShowSettings(false)}
                onAccountDeleted={() => { onClose(); }}
            />
        )}
        {showProgression && (
            <ProgressionScreen onClose={() => setShowProgression(false)} />
        )}
        </>
    );
}
