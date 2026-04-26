import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SearchResult } from '@services/friendService';
import { Avatar } from '@components/Avatar/Avatar';
import { getTier } from '@domain';
import { TierBadge } from '../TierBadge/TierBadge';
import './SearchResultCard.scss';

export interface SearchResultCardProps {
    result: SearchResult;
    onSend: () => void;
    onCancel: () => void;
}

export function SearchResultCard({ result, onSend, onCancel }: SearchResultCardProps) {
    const { t } = useTranslation('modals');
    const [loading, setLoading] = useState(false);

    const handle = async (fn: () => void) => {
        setLoading(true);
        await fn();
        setLoading(false);
    };

    const tier = getTier(result.level);

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
                    <span>{t('friends.card.stat_reps', { count: result.totalReps })}</span>
                    <span className="friend-stats-dot">·</span>
                    <span>{t('friends.card.stat_sessions', { count: result.totalSessions })}</span>
                </div>
            </div>
            <div className="friend-search-action">
                {result.relation === 'friend' && (
                    <span className="friend-badge friend-badge--already">{t('friends.search.already_friends')}</span>
                )}
                {result.relation === 'request_sent' && (
                    <button
                        type="button"
                        className="btn-cancel-request"
                        disabled={loading}
                        onClick={() => handle(onCancel)}
                    >
                        {loading ? t('friends.search_loading') : t('friends.cancel_request')}
                    </button>
                )}
                {result.relation === 'request_received' && (
                    <span className="friend-badge friend-badge--incoming">{t('friends.search.pending')}</span>
                )}
                {result.relation === 'none' && (
                    <button
                        type="button"
                        className="btn-add-friend"
                        disabled={loading}
                        onClick={() => handle(onSend)}
                    >
                        {loading ? t('friends.search_loading') : t('friends.search.add')}
                    </button>
                )}
            </div>
        </div>
    );
}
