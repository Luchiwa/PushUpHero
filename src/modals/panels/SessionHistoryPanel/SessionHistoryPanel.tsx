/**
 * SessionHistoryPanel — displays sessions list.
 * When `sessions` prop is provided, renders that list directly.
 * Otherwise falls back to useSessionHistory() (last 5 sessions).
 */
import { useState, type CSSProperties } from 'react';
import { useSessionHistory } from '@hooks/useSessionHistory';
import type { SessionRecord } from '@exercises/types';
import type { TimeDuration } from '@exercises/types';
import { getExerciseLabel, EXERCISE_META } from '@exercises/types';
import { getGradeLetter, getGradeClass, getGradeColor, formatElapsedTime } from '@domain/constants';
import './SessionHistoryPanel.scss';

const EXERCISE_EMOJI: Record<string, string> = Object.fromEntries(
    EXERCISE_META.map(m => [m.type, m.emoji]),
);

interface SessionHistoryPanelProps {
    sessions?: SessionRecord[];
    title?: string;
    onViewAll?: () => void;
}

/** Compact relative day label: TODAY / YESTERDAY / MON / 12 APR */
function formatRelativeDay(ts: number): string {
    const d = new Date(ts);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'TODAY';
    if (d.toDateString() === yesterday.toDateString()) return 'YESTERDAY';

    // Within the last 6 days → weekday name (MON, TUE…)
    const diffDays = Math.floor((today.getTime() - d.getTime()) / 86_400_000);
    if (diffDays < 7) {
        return d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
    }

    // Older → "12 APR"
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }).toUpperCase();
}

/** 24h time, e.g. "14:30" */
function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
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
                {sessions.map((s, idx) => {
                    const isMulti = s.isMultiExercise === true;
                    const isExpanded = expandedId === s.id;
                    const duration = getSessionDuration(s);
                    const gradeLetter = getGradeLetter(s.averageScore);
                    const gradeColor = getGradeColor(s.averageScore);
                    const gradeClass = getGradeClass(s.averageScore);

                    // Per-card grade tinting via CSS custom property — keeps the
                    // SCSS rules generic instead of one selector per grade.
                    const cardStyle = {
                        '--grade-color': gradeColor,
                        animationDelay: `${idx * 45}ms`,
                    } as CSSProperties;

                    // ── Single-exercise per-card derived values ──
                    const nSets = s.numberOfSets ?? 1;
                    const effectiveGoal = !isMulti && nSets > 1 && s.sets
                        ? s.sets.reduce((sum, set) => sum + (set.goalReps ?? 0), 0)
                        : nSets > 1
                            ? s.goalReps * nSets
                            : s.goalReps;
                    const goalReached = !isMulti && s.reps >= effectiveGoal;
                    const isTimeMode = !isMulti && s.sessionMode === 'time';

                    const exerciseLabel = isMulti
                        ? 'Mixed Workout'
                        : getExerciseLabel(s.exerciseType ?? 'pushup');
                    const exerciseEmoji = isMulti
                        ? '🏋️'
                        : EXERCISE_EMOJI[s.exerciseType ?? 'pushup'];

                    return (
                        <li
                            key={s.id}
                            className={`session-history-item session-card session-card--grade-${gradeLetter.toLowerCase()}${isMulti ? ' session-card--multi' : ''}${isExpanded ? ' session-card--expanded' : ''}`}
                            style={cardStyle}
                        >
                            <button
                                type="button"
                                className="session-card__row"
                                onClick={isMulti ? () => setExpandedId(isExpanded ? null : s.id) : undefined}
                                style={isMulti ? undefined : { cursor: 'default' }}
                            >
                                {/* ── Zone 1 — Identity ─────────────────────────── */}
                                <div className="session-card__identity">
                                    <span className="session-card__icon" aria-hidden="true">{exerciseEmoji}</span>
                                    <span className="session-card__day">{formatRelativeDay(s.date)}</span>
                                    <span className="session-card__time">{formatTime(s.date)}</span>
                                </div>

                                {/* ── Zone 2 — Metrics ──────────────────────────── */}
                                <div className="session-card__metrics">
                                    <div className="session-card__exercise-label">{exerciseLabel}</div>

                                    <div className="session-card__hero">
                                        {isMulti ? (
                                            <>
                                                <span className="session-card__hero-number">{s.reps}</span>
                                                <span className="session-card__hero-suffix">reps</span>
                                            </>
                                        ) : isTimeMode ? (
                                            <>
                                                <span className="session-card__hero-number">{formatElapsedTime(s.elapsedTime)}</span>
                                                <span className="session-card__hero-suffix">· {s.reps} reps</span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="session-card__hero-number">{s.reps}</span>
                                                <span className="session-card__hero-suffix">/{effectiveGoal} reps</span>
                                            </>
                                        )}
                                        {goalReached && <span className="session-card__trophy" title="Goal reached">🏆</span>}
                                    </div>

                                    <div className="session-card__meta">
                                        {isMulti ? (
                                            <>
                                                <span className="session-card__chip">{s.blocks?.length ?? 0} exercises</span>
                                                <span className="session-card__chip">{s.sets?.length ?? 0} sets</span>
                                                {duration && <span className="session-card__chip">{duration}</span>}
                                            </>
                                        ) : (
                                            <>
                                                {nSets > 1 && <span className="session-card__chip">{nSets} sets</span>}
                                                {duration && <span className="session-card__chip">{duration}</span>}
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* ── Zone 3 — Score ────────────────────────────── */}
                                <div className="session-card__score">
                                    <span className={`session-card__grade ${gradeClass}`}>
                                        {gradeLetter}
                                    </span>
                                    {s.xpEarned != null && s.xpEarned > 0 && (
                                        <span className="session-card__xp">+{s.xpEarned.toLocaleString()} XP</span>
                                    )}
                                    {isMulti && (
                                        <span className={`session-card__chevron${isExpanded ? ' session-card__chevron--open' : ''}`} aria-hidden="true">▾</span>
                                    )}
                                </div>
                            </button>

                            {/* ── Multi-exercise integrated breakdown ──────── */}
                            {isMulti && s.blocks && (
                                <div className="session-card__breakdown">
                                    <div className="session-card__breakdown-inner">
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
                                                const blockGradeClass = getGradeClass(blockAvg);
                                                const modeLabel = block.sessionMode === 'time'
                                                    ? `⏱ ${formatTimeDuration(block.timeGoal)}`
                                                    : `🎯 ${block.goalReps} reps`;

                                                return (
                                                    <div key={`${s.id}-block-${bi}`} className="session-card__block">
                                                        <div className="session-card__block-header">
                                                            <span className="session-card__block-label">{emoji} {label}</span>
                                                            <span className={`session-card__block-grade ${blockGradeClass}`}>{grade}</span>
                                                        </div>
                                                        <div className="session-card__block-meta">
                                                            <span>{block.numberOfSets} set{block.numberOfSets > 1 ? 's' : ''}</span>
                                                            <span className="session-card__block-sep">·</span>
                                                            <span>{modeLabel}</span>
                                                            <span className="session-card__block-sep">·</span>
                                                            <span>🔄 {formatTimeDuration(block.restBetweenSets)}</span>
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
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
