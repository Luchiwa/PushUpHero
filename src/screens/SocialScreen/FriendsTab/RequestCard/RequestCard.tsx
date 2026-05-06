import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FriendRequest, OutgoingRequest } from '@services/friendService';
import { Avatar } from '@components/Avatar/Avatar';
import './RequestCard.scss';

export interface RequestCardProps {
    request: FriendRequest;
    onAccept: () => void;
    onDecline: () => void;
}

export function RequestCard({ request, onAccept, onDecline }: RequestCardProps) {
    const { t } = useTranslation('friends');
    const [loading, setLoading] = useState(false);

    const handle = async (fn: () => void) => {
        setLoading(true);
        await fn();
        setLoading(false);
    };

    return (
        <div className="friend-card friend-card--request">
            <Avatar photoURL={undefined} initials={request.fromUsername} size={40} />
            <div className="friend-info">
                <span className="friend-name">{request.fromUsername}</span>
                <span className="friend-request-label">{t('request_label')}</span>
            </div>
            <div className="friend-request-actions">
                <button
                    type="button"
                    className="btn-accept"
                    disabled={loading}
                    onClick={() => handle(onAccept)}
                    title={t('accept_aria')}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </button>
                <button
                    type="button"
                    className="btn-decline"
                    disabled={loading}
                    onClick={() => handle(onDecline)}
                    title={t('decline_aria')}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
            </div>
        </div>
    );
}

export interface OutgoingRequestCardProps {
    request: OutgoingRequest;
    onCancel: () => void;
}

export function OutgoingRequestCard({ request, onCancel }: OutgoingRequestCardProps) {
    const { t } = useTranslation('friends');
    const [loading, setLoading] = useState(false);

    const handle = async (fn: () => void) => {
        setLoading(true);
        await fn();
        setLoading(false);
    };

    return (
        <div className="friend-card friend-card--outgoing">
            <Avatar photoURL={undefined} initials={request.toUsername} size={40} />
            <div className="friend-info">
                <span className="friend-name">{request.toUsername}</span>
                <span className="friend-pending-label">{t('request_sent_label')}</span>
            </div>
            <div className="friend-search-action">
                <button
                    type="button"
                    className="btn-cancel-request"
                    disabled={loading}
                    onClick={() => handle(onCancel)}
                >
                    {loading ? t('search_loading') : t('cancel_request')}
                </button>
            </div>
        </div>
    );
}
