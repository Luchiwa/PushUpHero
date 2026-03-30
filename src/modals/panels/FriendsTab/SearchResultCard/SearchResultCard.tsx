import { useState } from 'react';
import type { SearchResult } from '@hooks/useFriends';
import { Avatar } from '@components/Avatar/Avatar';
import { TierBadge, TIER_FROM_LEVEL } from '../TierBadge/TierBadge';
import './SearchResultCard.scss';

export interface SearchResultCardProps {
    result: SearchResult;
    onSend: () => void;
    onCancel: () => void;
}

export function SearchResultCard({ result, onSend, onCancel }: SearchResultCardProps) {
    const [loading, setLoading] = useState(false);

    const handle = async (fn: () => void) => {
        setLoading(true);
        await fn();
        setLoading(false);
    };

    const tier = TIER_FROM_LEVEL(result.level);

    return (
        <div className={`friend-card friend-card--search tier-${tier}`}>
            <TierBadge level={result.level} />
            <div className="friend-card-avatar-wrap">
                <Avatar photoURL={undefined} initials={result.displayName} size={40} />
                <span className={`friend-card-level-pip tier-${tier}`}>LV{result.level}</span>
            </div>
            <div className="friend-info">
                <span className="friend-name">{result.displayName}</span>
                <div className="friend-stats">
                    <span>{result.totalReps.toLocaleString()} reps</span>
                    <span className="friend-stats-dot">·</span>
                    <span>{result.totalSessions} sessions</span>
                </div>
            </div>
            <div className="friend-search-action">
                {result.relation === 'friend' && (
                    <span className="friend-badge friend-badge--already">Friends</span>
                )}
                {result.relation === 'request_sent' && (
                    <button
                        type="button"
                        className="btn-cancel-request"
                        disabled={loading}
                        onClick={() => handle(onCancel)}
                    >
                        {loading ? '…' : 'Cancel'}
                    </button>
                )}
                {result.relation === 'request_received' && (
                    <span className="friend-badge friend-badge--incoming">Pending</span>
                )}
                {result.relation === 'none' && (
                    <button
                        type="button"
                        className="btn-add-friend"
                        disabled={loading}
                        onClick={() => handle(onSend)}
                    >
                        {loading ? '…' : '+ Add'}
                    </button>
                )}
            </div>
        </div>
    );
}
