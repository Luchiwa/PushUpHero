import { useEffect, useState } from 'react';
import { useWeekSessions, getWeekStart, formatWeekRange } from '@hooks/useWeekSessions';
import { WeeklyChart } from './WeeklyChart';
import { SessionHistoryPanel } from '@components/SessionHistoryPanel/SessionHistoryPanel';
import './StatsScreen.scss';
import './WeeklyChart.scss';

interface StatsScreenProps {
    onClose: () => void;
}

export function StatsScreen({ onClose }: StatsScreenProps) {
    const [weekOffset, setWeekOffset] = useState(0);
    const { sessions, loading, firstSessionDate, fetchWeek } = useWeekSessions();

    useEffect(() => {
        fetchWeek(weekOffset);
    }, [weekOffset, fetchWeek]);

    const isPrevDisabled = firstSessionDate === null
        || getWeekStart(weekOffset - 1).getTime() + 7 * 86_400_000 <= firstSessionDate;

    const isNextDisabled = weekOffset >= 0;

    const hasActivity = sessions.some(s => s.reps > 0);

    return (
        <div className="stats-screen">
            {/* Top bar */}
            <div className="stats-topbar">
                <button className="btn-icon stats-back-btn" onClick={onClose} aria-label="Back">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>
                <span className="stats-topbar-title">Statistics</span>
                <div style={{ width: 40 }} />
            </div>

            <div className="stats-body">
                <div className="stats-fixed-top">
                {/* Week chart section */}
                <div className="stats-chart-section">
                    {/* Week navigation header */}
                    <div className="stats-week-nav">
                        <button
                            className="btn-icon stats-nav-btn"
                            onClick={() => setWeekOffset(w => w - 1)}
                            disabled={isPrevDisabled}
                            aria-label="Previous week"
                        >
                            ‹
                        </button>
                        <span className="stats-week-label">{formatWeekRange(weekOffset)}</span>
                        <button
                            className="btn-icon stats-nav-btn"
                            onClick={() => setWeekOffset(w => w + 1)}
                            disabled={isNextDisabled}
                            aria-label="Next week"
                        >
                            ›
                        </button>
                    </div>

                    {/* Chart or empty state */}
                    {loading ? (
                        <div className="stats-chart-placeholder">
                            <span className="stats-loading-dot" />
                        </div>
                    ) : hasActivity ? (
                        <div className="stats-chart-wrap">
                            <WeeklyChart sessions={sessions} weekOffset={weekOffset} />
                        </div>
                    ) : (
                        <div className="stats-empty-week">
                            <span className="stats-empty-icon">🏖️</span>
                            <p>No activity this week</p>
                        </div>
                    )}
                </div>

                </div>{/* end stats-fixed-top */}

                {/* Titre fixe hors scroll */}
                {(sessions.length > 0 || !loading) && (
                    <p className="stats-sessions-title">This week's sessions</p>
                )}

                {/* Session list — seule zone scrollable */}
                <div className="stats-sessions-scroll">
                    {sessions.length > 0 ? (
                        <SessionHistoryPanel sessions={sessions} />
                    ) : !loading && (
                        <p className="stats-sessions-empty">No sessions to display.</p>
                    )}
                </div>
            </div>{/* end stats-body */}
        </div>
    );
}
