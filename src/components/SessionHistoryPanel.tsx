/**
 * SessionHistoryPanel — displays the last 5 sessions on the start screen.
 */
import { useMemo } from 'react';
import { useSessionHistory } from '../hooks/useSessionHistory';

function formatDate(ts: number): string {
    const d = new Date(ts);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    if (d.toDateString() === today.toDateString()) return `Today at ${time}`;
    if (d.toDateString() === yesterday.toDateString()) return `Yesterday at ${time}`;

    const date = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    return `${date} at ${time}`;
}

function formatElapsedTime(seconds?: number): string {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) return `${mins}min${secs}s`;
    return `${secs}s`;
}

function scoreColor(score: number): string {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
}

export function SessionHistoryPanel() {
    const { getSessions } = useSessionHistory();
    const sessions = useMemo(() => getSessions(), [getSessions]);

    if (sessions.length === 0) return null;

    return (
        <div className="session-history">
            <p className="session-history-title">Recent sessions</p>
            <ul className="session-history-list">
                {sessions.map((s) => {
                    return (
                        <li key={s.id} className="session-history-item">
                            <div className="session-history-left">
                                <span className="session-date">{formatDate(s.date)}</span>
                                <div className="session-details">
                                    {s.sessionMode === 'time' ? (
                                        <>
                                            <span className="session-reps">
                                                {formatElapsedTime(s.elapsedTime)} • {s.reps} reps
                                            </span>
                                        </>
                                    ) : (
                                        <span className="session-reps">
                                            {s.reps}
                                            <span className="session-goal">/{s.goalReps}</span>
                                        </span>
                                    )}
                                    {s.reps >= s.goalReps && <span className="session-trophy" title="Goal reached">🏆</span>}
                                </div>
                            </div>

                            <span
                                className="session-score"
                                style={{ color: scoreColor(s.averageScore) }}
                            >
                                {s.averageScore}%
                            </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
