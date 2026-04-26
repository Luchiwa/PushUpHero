import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useActivityFeed, buildEventMessage, formatRelativeTime } from '@hooks/useActivityFeed';
import { getGradeLetter, getGradeColor, getGradeBackground } from '@domain';
import type { Friend } from '@services/friendService';
import { Avatar } from '@components/Avatar/Avatar';
import './FriendsFeedPanel.scss';

interface FriendsFeedPanelProps {
    friends: Friend[];
}

export function FriendsFeedPanel({ friends }: FriendsFeedPanelProps) {
    const { t } = useTranslation('modals');
    const { feed, loading, error, refresh } = useActivityFeed(friends);

    const todayFeed = useMemo(() => {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        return feed.filter(e => e.createdAt >= todayStart.getTime());
    }, [feed]);

    const earlierFeed = useMemo(() => {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        return feed.filter(e => e.createdAt < todayStart.getTime());
    }, [feed]);

    if (friends.length === 0) {
        return (
            <div className="feed-empty">
                <span className="feed-empty-icon">👥</span>
                <p>{t('feed.empty_no_friends')}</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="feed-skeleton">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="feed-skeleton-item">
                        <div className="feed-skeleton-avatar" />
                        <div className="feed-skeleton-lines">
                            <div className="feed-skeleton-line feed-skeleton-line--name" />
                            <div className="feed-skeleton-line feed-skeleton-line--msg" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="feed-error">
                <p>{t(error)}</p>
                <button className="btn-text" onClick={refresh}>{t('feed.error_retry')}</button>
            </div>
        );
    }

    if (feed.length === 0) {
        return (
            <div className="feed-empty">
                <span className="feed-empty-icon">💤</span>
                <p>{t('feed.empty_no_activity')}</p>
            </div>
        );
    }

    return (
        <div className="friends-feed">
            <div className="feed-header">
                <span className="feed-header-title">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true" style={{ color: 'var(--accent)' }}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                    {t('feed.header_title')}
                </span>
                <span className="feed-live-badge">
                    <span className="feed-live-dot" />
                    {t('feed.live_badge')}
                </span>
            </div>

            <div className="feed-scroll">
            {todayFeed.length > 0 && (
                <section className="feed-section">
                    <div className="feed-divider"><span>{t('feed.section_today')}</span></div>
                    <ul className="feed-list">
                        {todayFeed.map((event, i) => (
                            <FeedItem key={`${event.uid}-${event.id}`} event={event} index={i} t={t} />
                        ))}
                    </ul>
                </section>
            )}

            {earlierFeed.length > 0 && (
                <section className="feed-section">
                    <div className="feed-divider"><span>{t('feed.section_earlier')}</span></div>
                    <ul className="feed-list">
                        {earlierFeed.map((event, i) => (
                            <FeedItem key={`${event.uid}-${event.id}`} event={event} index={todayFeed.length + i} t={t} />
                        ))}
                    </ul>
                </section>
            )}
            </div>{/* end feed-scroll */}
        </div>
    );
}

function FeedItem({ event, index, t }: { event: import('@hooks/useActivityFeed').ActivityEvent; index: number; t: TFunction<'modals'> }) {
    const grade = getGradeLetter(event.averageScore);
    const gradeColor = getGradeColor(event.averageScore);
    const gradeBg = getGradeBackground(event.averageScore);
    const message = buildEventMessage(event, t);

    return (
        <li className="feed-item" style={{ animationDelay: `${index * 55}ms` }}>
            <div className="feed-item-avatar-wrap">
                <Avatar photoURL={event.photoURL} photoThumb={event.photoThumb} initials={event.displayName} size={38} />
            </div>
            <div className="feed-item-body">
                <span className="feed-item-name">{event.displayName}</span>
                <span className="feed-item-msg">{message}</span>
            </div>
            <div className="feed-item-right">
                <span
                    className="feed-grade-badge"
                    style={{ color: gradeColor, background: gradeBg, borderColor: gradeColor }}
                >
                    {grade}
                </span>
                <span className="feed-item-time">{formatRelativeTime(event.createdAt, t)}</span>
            </div>
        </li>
    );
}
