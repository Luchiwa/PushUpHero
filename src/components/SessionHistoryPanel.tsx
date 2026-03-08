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

    if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
    if (d.toDateString() === yesterday.toDateString()) return 'Hier';

    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
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
            <p className="session-history-title">Dernières sessions</p>
            <ul className="session-history-list">
                {sessions.map((s) => {
                    const goalReached = s.reps >= s.goalReps;
                    return (
                        <li key={s.id} className="session-history-item">
                            <span className="session-date">{formatDate(s.date)}</span>

                            <span className="session-reps">
                                {s.reps}
                                <span className="session-goal">/{s.goalReps}</span>
                            </span>

                            {goalReached && <span className="session-trophy" title="Objectif atteint">🏆</span>}

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
