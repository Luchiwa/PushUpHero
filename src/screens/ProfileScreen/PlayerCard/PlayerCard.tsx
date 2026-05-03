/**
 * PlayerCard — hero block for ProfileScreen.
 *
 * Avatar (uploadable) + tier ring + level badge, displayName + streak,
 * member-since, 14-segment XP bar (tappable → opens Progression), three
 * mini-stats.
 *
 * Owns its own hooks because the alternative — receiving a dozen props
 * from the parent — pushes wiring noise upstream for no payoff. The only
 * callback is `onProgressionOpen` since the XP bar is the entry point
 * and ProgressionScreen is rendered by the parent.
 */
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthCore, useLevel } from '@hooks/useAuth';
import { useFriends } from '@hooks/useFriends';
import { useSessionHistory } from '@hooks/useSessionHistory';
import { Avatar } from '@components/Avatar/Avatar';
import { formatDate, formatNumber, getTier } from '@domain';
import './PlayerCard.scss';

interface PlayerCardProps {
    onProgressionOpen: () => void;
}

export function PlayerCard({ onProgressionOpen }: PlayerCardProps) {
    const { t } = useTranslation('profile');
    const { user, dbUser, uploadAvatar } = useAuthCore();
    const { level, totalXp, xpIntoCurrentLevel, xpNeededForNextLevel, levelProgressPct } = useLevel();
    const { totalSessionCount } = useSessionHistory();
    const { friends } = useFriends();

    const tier = getTier(level);
    const streak = dbUser?.stats.streak ?? 0;

    // XP bar: 14 segments (Arena spec)
    const XP_SEGS = useMemo(() => Array.from({ length: 14 }, (_, i) => i), []);
    const filledSegments = Math.round((levelProgressPct / 100) * XP_SEGS.length);

    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAvatarClick = () => fileInputRef.current?.click();
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try { await uploadAvatar(file); } finally { setUploading(false); e.target.value = ''; }
    };

    if (!user) return null;

    const memberSince = dbUser?.profile.createdAt
        ? formatDate(dbUser.profile.createdAt)
        : '';

    return (
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
                <h2 className="player-card-name">{dbUser?.profile.displayName || t('default_user_name')}</h2>
                {streak > 0 && (
                    <span className={`player-card-streak${streak >= 7 ? ' on-fire' : ''}`}>
                        {streak}<span className="player-card-streak-icon">🔥</span>
                    </span>
                )}
            </div>
            <span className="player-card-since">{t('member_since', { date: memberSince })}</span>

            {/* XP bar — tappable → opens Progression */}
            <button type="button" className="player-card-xp-btn" onClick={onProgressionOpen}>
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
                    <span>{formatNumber(xpIntoCurrentLevel)} XP</span>
                    <span className="player-card-xp-next">{t('xp_label_next', { level: level + 1, remaining: formatNumber(xpNeededForNextLevel - xpIntoCurrentLevel) })}</span>
                </div>
                <div className="player-card-xp-cta">
                    <span>🏆</span>
                    <span>{t('progression_cta')}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                </div>
            </button>

            {/* Stat mini-cards */}
            <div className="player-card-stats">
                <div className="player-card-stat">
                    <svg className="player-card-stat-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    <span className="player-card-stat-val">{formatNumber(totalXp)}</span>
                    <span className="player-card-stat-lbl">{t('stat_total_xp')}</span>
                </div>
                <div className="player-card-stat">
                    <svg className="player-card-stat-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <span className="player-card-stat-val">{totalSessionCount}</span>
                    <span className="player-card-stat-lbl">{t('stat_sessions')}</span>
                </div>
                <div className="player-card-stat">
                    <svg className="player-card-stat-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    <span className="player-card-stat-val">{friends.length}</span>
                    <span className="player-card-stat-lbl">{t('stat_friends')}</span>
                </div>
            </div>
        </div>
    );
}
