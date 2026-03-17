/**
 * SessionHistoryPanel — displays sessions list.
 * When `sessions` prop is provided, renders that list directly.
 * Otherwise falls back to useSessionHistory() (last 5 sessions).
 */
import { useSessionHistory } from '@hooks/useSessionHistory';
import type { SessionRecord } from '@hooks/useSessionHistory';
import { formatElapsedTime } from '@lib/constants';
import './SessionHistoryPanel.scss';

interface SessionHistoryPanelProps {
    sessions?: SessionRecord[];
    title?: string;
    onViewAll?: () => void;
}

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

function scoreColor(score: number): string {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
}

export function SessionHistoryPanel({ sessions: sessionsProp, title, onViewAll }: SessionHistoryPanelProps) {
    const { sessions: hookSessions, totalSessionCount } = useSessionHistory();

    const sessions = sessionsProp ?? hookSessions;
    const resolvedTitle = title ?? 'Recent sessions';
    const showViewAll = !sessionsProp && onViewAll && totalSessionCount > 5;

    if (sessions.length === 0) return null;

    return (
        <div className="session-history">
            <p className="session-history-title">{resolvedTitle}</p>
            <ul className="session-history-list">
                {sessions.map((s) => {
                    return (
                        <li key={s.id} className="session-history-item">
                            <div className="session-history-left">
                                <span className="session-date">{formatDate(s.date)}</span>
                                <div className="session-details">
                                    {(() => {
                                        // For multi-set sessions saved before the fix, goalReps was per-set.
                                        // Compute effective total goal: if sets data exists, sum per-set goals.
                                        const nSets = s.numberOfSets ?? 1;
                                        const effectiveGoal = nSets > 1 && s.sets
                                            ? s.sets.reduce((sum, set) => sum + (set.goalReps ?? 0), 0)
                                            : nSets > 1
                                                ? s.goalReps * nSets
                                                : s.goalReps;
                                        const goalReached = s.reps >= effectiveGoal;

                                        return s.sessionMode === 'time' ? (
                                            <>
                                                <span className="session-reps">
                                                    {formatElapsedTime(s.elapsedTime)} • {s.reps} reps
                                                </span>
                                                {nSets > 1 && (
                                                    <span className="session-sets-badge">{nSets} sets</span>
                                                )}
                                                {goalReached && <span className="session-trophy" title="Goal reached">🏆</span>}
                                            </>
                                        ) : (
                                            <>
                                                <span className="session-reps">
                                                    {s.reps}
                                                    <span className="session-goal">/{effectiveGoal}</span>
                                                </span>
                                                {nSets > 1 && (
                                                    <span className="session-sets-badge">{nSets} sets</span>
                                                )}
                                                {goalReached && <span className="session-trophy" title="Goal reached">🏆</span>}
                                            </>
                                        );
                                    })()}
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
            {showViewAll && (
                <button className="session-history-view-all" onClick={onViewAll}>
                    View all history
                </button>
            )}
        </div>
    );
}
