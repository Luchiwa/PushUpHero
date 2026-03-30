import { useState, useEffect, useCallback } from 'react';
import type { Friend } from '@hooks/useFriends';
import { Avatar } from '@components/Avatar/Avatar';
import { ENCOURAGE_COOLDOWN_MS } from '@lib/constants';
import { TierBadge, TIER_FROM_LEVEL } from '../TierBadge/TierBadge';
import './FriendCard.scss';

const ENCOURAGE_KEY = (uid: string) => `pushup_encourage_${uid}`;

function useEncourageCooldown(friendUid: string) {
    const getRemaining = useCallback(() => {
        const last = parseInt(localStorage.getItem(ENCOURAGE_KEY(friendUid)) || '0', 10);
        return Math.max(0, ENCOURAGE_COOLDOWN_MS - (Date.now() - last));
    }, [friendUid]);
    const [remaining, setRemaining] = useState(getRemaining);
    const isActive = remaining > 0;

    useEffect(() => {
        if (!isActive) return;
        const id = setInterval(() => {
            const r = getRemaining();
            setRemaining(r);
            if (r <= 0) clearInterval(id);
        }, 30_000);
        return () => clearInterval(id);
    }, [isActive, getRemaining]);

    const markSent = () => {
        localStorage.setItem(ENCOURAGE_KEY(friendUid), Date.now().toString());
        setRemaining(ENCOURAGE_COOLDOWN_MS);
    };

    const minutesLeft = Math.ceil(remaining / 60_000);
    return { onCooldown: remaining > 0, minutesLeft, markSent };
}

export interface FriendCardProps {
    friend: Friend;
    onRemove: () => void;
    onEncourage: () => Promise<void>;
}

export function FriendCard({ friend, onRemove, onEncourage }: FriendCardProps) {
    const { onCooldown, minutesLeft, markSent } = useEncourageCooldown(friend.uid);
    const [sending, setSending] = useState(false);

    const handleEncourage = async () => {
        if (onCooldown || sending) return;
        setSending(true);
        await onEncourage();
        markSent();
        setSending(false);
    };

    const tier = TIER_FROM_LEVEL(friend.level);

    return (
        <div className={`friend-card tier-${tier}`}>
            <TierBadge level={friend.level} />
            <div className="friend-card-avatar-wrap">
                <Avatar photoURL={friend.photoURL} photoThumb={friend.photoThumb} initials={friend.displayName} size={40} />
                <span className={`friend-card-level-pip tier-${tier}`}>LV{friend.level}</span>
            </div>
            <div className="friend-info">
                <span className="friend-name">
                    {friend.displayName}
                    {(friend.streak ?? 0) > 0 && (
                        <span className={`friend-streak${(friend.streak ?? 0) >= 7 ? ' friend-streak--fire' : ''}`}>
                            🔥 {friend.streak}
                        </span>
                    )}
                </span>
                <div className="friend-stats">
                    <span>{friend.totalReps.toLocaleString()} reps</span>
                    <span className="friend-stats-dot">·</span>
                    <span>{friend.totalSessions} sessions</span>
                </div>
            </div>
            <div className="friend-card-actions">
                <button
                    type="button"
                    className={`btn-encourage${onCooldown ? ' btn-encourage--cooldown' : ''}${sending ? ' btn-encourage--sending' : ''}`}
                    onClick={handleEncourage}
                    disabled={onCooldown || sending}
                    title={onCooldown ? `Send again in ${minutesLeft} min` : 'Send encouragement'}
                    aria-label="Encourage"
                >
                    {sending ? <span className="btn-encourage-spinner" /> : '💪'}
                </button>
                <button type="button" className="btn-remove-friend" onClick={onRemove} title="Remove friend" aria-label="Remove friend">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <line x1="23" y1="11" x2="17" y2="11"/>
                    </svg>
                </button>
            </div>
        </div>
    );
}
