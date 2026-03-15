import { useMemo } from 'react';
import { useActivityFeed, buildEventMessage, formatRelativeTime, getGradeColor } from '@hooks/useActivityFeed';
import type { Friend } from '@hooks/useFriends';
import { Avatar } from '@components/Avatar/Avatar';
import './FriendsFeedPanel.scss';

interface FriendsFeedPanelProps {
    friends: Friend[];
}

function getGradeLetter(score: number): string {
    if (score >= 95) return 'S';
    if (score >= 80) return 'A';
    if (score >= 65) return 'B';
    if (score >= 50) return 'C';
    return 'D';
}

export function FriendsFeedPanel({ friends }: FriendsFeedPanelProps) {
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
                <p>Add friends to see their activity here.</p>
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
                <p>{error}</p>
                <button className="btn-text" onClick={refresh}>Try again</button>
            </div>
        );
    }

    if (feed.length === 0) {
        return (
            <div className="feed-empty">
                <span className="feed-empty-icon">💤</span>
                <p>No activity yet. Challenge your friends!</p>
            </div>
        );
    }

    return (
        <div className="friends-feed">
            <div className="feed-header">
                <span className="feed-header-title">Friends Activity</span>
                <button className="feed-refresh-btn" onClick={refresh} aria-label="Refresh feed">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 4 23 10 17 10" />
                        <polyline points="1 20 1 14 7 14" />
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                </button>
            </div>

            <div className="feed-scroll">
            {todayFeed.length > 0 && (
                <section className="feed-section">
                    <p className="feed-section-label">Today</p>
                    <ul className="feed-list">
                        {todayFeed.map(event => (
                            <FeedItem key={`${event.uid}-${event.id}`} event={event} />
                        ))}
                    </ul>
                </section>
            )}

            {earlierFeed.length > 0 && (
                <section className="feed-section">
                    <p className="feed-section-label">Earlier</p>
                    <ul className="feed-list">
                        {earlierFeed.map(event => (
                            <FeedItem key={`${event.uid}-${event.id}`} event={event} />
                        ))}
                    </ul>
                </section>
            )}
            </div>{/* end feed-scroll */}
        </div>
    );
}

function FeedItem({ event }: { event: import('@hooks/useActivityFeed').ActivityEvent }) {
    const grade = getGradeLetter(event.averageScore);
    const gradeColor = getGradeColor(event.averageScore);
    const message = buildEventMessage(event);

    return (
        <li className="feed-item">
            <Avatar photoURL={event.photoURL} initials={event.displayName} size={36} />
            <div className="feed-item-body">
                <span className="feed-item-name">{event.displayName}</span>
                <span className="feed-item-msg">{message}</span>
            </div>
            <div className="feed-item-right">
                <span
                    className="feed-grade-badge"
                    style={{ color: gradeColor, borderColor: gradeColor }}
                >
                    {grade}
                </span>
                <span className="feed-item-time">{formatRelativeTime(event.createdAt)}</span>
            </div>
        </li>
    );
}
