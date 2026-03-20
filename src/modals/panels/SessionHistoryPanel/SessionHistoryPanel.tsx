/**
 * SessionHistoryPanel — displays sessions list.
 * When `sessions` prop is provided, renders that list directly.
 * Otherwise falls back to useSessionHistory() (last 5 sessions).
 */
import { useState } from 'react';
import { useSessionHistory } from '@hooks/useSessionHistory';
import type { SessionRecord } from '@hooks/useSessionHistory';
import type { TimeDuration } from '@exercises/types';
import { getExerciseLabel } from '@exercises/types';
import { getGradeLetter, getGradeClass, formatElapsedTime } from '@lib/constants';
import './SessionHistoryPanel.scss';

const EXERCISE_EMOJI: Record<string, string> = {
    pushup: '💪',
    squat: '🦵',
};

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

/** Format a TimeDuration object to a compact string, e.g. "1min30s" */
function formatTimeDuration(td: TimeDuration | undefined): string {
    if (!td) return '—';
    const { minutes, seconds } = td;
    if (minutes > 0 && seconds > 0) return `${minutes}min${seconds}s`;
    if (minutes > 0) return `${minutes}min`;
    if (seconds > 0) return `${seconds}s`;
    return '0s';
}

/** Get the best available workout duration for a session */
function getSessionDuration(s: SessionRecord): string {
    // elapsedTime is the primary source (set by the workout timer)
    if (s.elapsedTime && s.elapsedTime > 0) return formatElapsedTime(s.elapsedTime);
    // totalDuration is an alternative saved field
    if (s.totalDuration && s.totalDuration > 0) return formatElapsedTime(s.totalDuration);
    // Fallback: sum set durations
    if (s.sets && s.sets.length > 0) {
        const total = s.sets.reduce((sum, set) => sum + (set.duration ?? 0), 0);
        if (total > 0) return formatElapsedTime(total);
    }
    return '';
}

export function SessionHistoryPanel({ sessions: sessionsProp, title, onViewAll }: SessionHistoryPanelProps) {
    const { sessions: hookSessions, totalSessionCount } = useSessionHistory();
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const sessions = sessionsProp ?? hookSessions;
    const resolvedTitle = title ?? 'Recent sessions';
    const showViewAll = !sessionsProp && onViewAll && totalSessionCount > 5;

    if (sessions.length === 0) return null;

    return (
        <div className="session-history">
            <p className="session-history-title">{resolvedTitle}</p>
            <ul className="session-history-list">
                {sessions.map((s) => {
                    const isMulti = s.isMultiExercise === true;
                    const isExpanded = expandedId === s.id;
                    const duration = isMulti ? getSessionDuration(s) : '';

                    return (
                        <li key={s.id} className={`session-history-item${isExpanded ? ' session-history-item--expanded' : ''}`}>
                            <button
                                type="button"
                                className="session-history-row"
                                onClick={isMulti ? () => setExpandedId(isExpanded ? null : s.id) : undefined}
                                style={isMulti ? undefined : { cursor: 'default' }}
                            >
                                <div className="session-history-left">
                                    <div className="session-date-row">
                                        <span className="session-date">{formatDate(s.date)}</span>
                                        {isMulti ? (
                                            <span className="session-exercise-badge session-exercise-badge--workout">
                                                🏋️ {duration || 'Workout'}
                                            </span>
                                        ) : (
                                            <span className="session-exercise-badge">
                                                {EXERCISE_EMOJI[s.exerciseType ?? 'pushup']} {getExerciseLabel(s.exerciseType ?? 'pushup')}
                                            </span>
                                        )}
                                    </div>
                                    <div className="session-details">
                                        {isMulti ? (
                                            <>
                                                <span className="session-reps">{s.reps} reps</span>
                                                <span className="session-sets-badge">
                                                    {s.blocks?.length ?? 0} exercises · {s.sets?.length ?? 0} sets
                                                </span>
                                            </>
                                        ) : (() => {
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

                                <div className="session-history-right">
                                    <span
                                        className="session-score"
                                        style={{ color: scoreColor(s.averageScore) }}
                                    >
                                        {s.averageScore}%
                                    </span>
                                    {isMulti && (
                                        <span className={`session-chevron${isExpanded ? ' session-chevron--open' : ''}`}>▾</span>
                                    )}
                                </div>
                            </button>

                            {/* Multi-exercise expanded detail — grouped by block */}
                            {isMulti && isExpanded && s.blocks && (
                                <div className="session-multi-detail">
                                    {(() => {
                                        const allSets = s.sets ?? [];
                                        let setIdx = 0;
                                        return s.blocks.map((block, bi) => {
                                            const blockSets = allSets.slice(setIdx, setIdx + block.numberOfSets);
                                            setIdx += block.numberOfSets;
                                            const blockReps = blockSets.reduce((sum, st) => sum + st.reps, 0);
                                            const blockAvg = blockReps > 0
                                                ? Math.round(blockSets.reduce((sum, st) => sum + st.averageScore * st.reps, 0) / blockReps)
                                                : 0;
                                            const emoji = EXERCISE_EMOJI[block.exerciseType] ?? '💪';
                                            const label = getExerciseLabel(block.exerciseType);
                                            const grade = getGradeLetter(blockAvg);
                                            const gradeClass = getGradeClass(blockAvg);
                                            const modeLabel = block.sessionMode === 'time'
                                                ? `⏱ ${formatTimeDuration(block.timeGoal)}`
                                                : `🎯 ${block.goalReps} reps`;

                                            return (
                                                <div key={`${s.id}-block-${bi}`} className="session-block-row">
                                                    <div className="session-block-header">
                                                        <span className="session-block-exercise">{emoji} {label}</span>
                                                        <span className={`session-block-grade ${gradeClass}`}>{grade}</span>
                                                    </div>
                                                    <div className="session-block-meta">
                                                        <span>{block.numberOfSets} set{block.numberOfSets > 1 ? 's' : ''}</span>
                                                        <span className="session-block-sep">·</span>
                                                        <span>{modeLabel}</span>
                                                        <span className="session-block-sep">·</span>
                                                        <span>🔄 {formatTimeDuration(block.restBetweenSets)}</span>
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
            {showViewAll && (
                <button type="button" className="session-history-view-all" onClick={onViewAll}>
                    View all history
                </button>
            )}
        </div>
    );
}
