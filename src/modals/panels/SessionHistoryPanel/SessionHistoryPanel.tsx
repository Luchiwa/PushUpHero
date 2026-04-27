/**
 * SessionHistoryPanel — displays sessions list.
 * When `sessions` prop is provided, renders that list directly.
 * Otherwise falls back to useSessionHistory() (last 5 sessions).
 */
import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useSessionHistory } from '@hooks/useSessionHistory';
import { EXERCISE_META, getExerciseLabelKey, type SessionRecord, type TimeDuration } from '@exercises/types';
import { formatDate, formatNumber, formatTime, getGradeLetter, getGradeClass, getGradeColor, formatElapsedTime } from '@domain';
import './SessionHistoryPanel.scss';

const EXERCISE_EMOJI: Record<string, string> = Object.fromEntries(
    EXERCISE_META.map(m => [m.type, m.emoji]),
);

interface SessionHistoryPanelProps {
    sessions?: SessionRecord[];
    title?: string;
    onViewAll?: () => void;
}

/** Compact relative day label: TODAY / YESTERDAY / MON / 12 APR (locale-aware). */
function formatRelativeDay(ts: number, t: TFunction<'modals'>): string {
    const d = new Date(ts);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return t('sessions.rel_today');
    if (d.toDateString() === yesterday.toDateString()) return t('sessions.rel_yesterday');

    // Within the last 6 days → weekday name (MON, TUE…)
    const diffDays = Math.floor((today.getTime() - d.getTime()) / 86_400_000);
    if (diffDays < 7) {
        return formatDate(d, { weekday: 'short' }).toUpperCase();
    }

    // Older → "12 APR"
    return formatDate(d, { day: 'numeric', month: 'short' }).toUpperCase();
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
    const { t } = useTranslation('modals');
    const { sessions: hookSessions, totalSessionCount } = useSessionHistory();
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const sessions = sessionsProp ?? hookSessions;
    const resolvedTitle = title ?? t('sessions.panel_title');
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
                        ? t('sessions.mixed_workout')
                        : t(getExerciseLabelKey(s.exerciseType ?? 'pushup'));
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
                                    <span className="session-card__day">{formatRelativeDay(s.date, t)}</span>
                                    <span className="session-card__time">{formatTime(s.date, { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                                </div>

                                {/* ── Zone 2 — Metrics ──────────────────────────── */}
                                <div className="session-card__metrics">
                                    <div className="session-card__exercise-label">{exerciseLabel}</div>

                                    <div className="session-card__hero">
                                        {isMulti ? (
                                            <>
                                                <span className="session-card__hero-number">{s.reps}</span>
                                                <span className="session-card__hero-suffix">{t('sessions.hero_suffix_reps')}</span>
                                            </>
                                        ) : isTimeMode ? (
                                            <>
                                                <span className="session-card__hero-number">{formatElapsedTime(s.elapsedTime)}</span>
                                                <span className="session-card__hero-suffix">{t('sessions.hero_suffix_time', { count: s.reps })}</span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="session-card__hero-number">{s.reps}</span>
                                                <span className="session-card__hero-suffix">{t('sessions.hero_suffix_partial', { goal: effectiveGoal })}</span>
                                            </>
                                        )}
                                        {goalReached && <span className="session-card__trophy" title={t('sessions.trophy_title')}>🏆</span>}
                                    </div>

                                    <div className="session-card__meta">
                                        {isMulti ? (
                                            <>
                                                <span className="session-card__chip">{t('sessions.chip_exercises', { count: s.blocks?.length ?? 0 })}</span>
                                                <span className="session-card__chip">{t('sessions.chip_sets', { count: s.sets?.length ?? 0 })}</span>
                                                {duration && <span className="session-card__chip">{duration}</span>}
                                            </>
                                        ) : (
                                            <>
                                                {nSets > 1 && <span className="session-card__chip">{t('sessions.chip_sets', { count: nSets })}</span>}
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
                                        <span className="session-card__xp">+{formatNumber(s.xpEarned)} XP</span>
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
                                                const label = t(getExerciseLabelKey(block.exerciseType));
                                                const grade = getGradeLetter(blockAvg);
                                                const blockGradeClass = getGradeClass(blockAvg);
                                                const modeLabel = block.sessionMode === 'time'
                                                    ? t('sessions.block.mode_time', { duration: formatTimeDuration(block.timeGoal) })
                                                    : t('sessions.block.mode_reps', { count: block.goalReps });

                                                return (
                                                    <div key={`${s.id}-block-${bi}`} className="session-card__block">
                                                        <div className="session-card__block-header">
                                                            <span className="session-card__block-label">{emoji} {label}</span>
                                                            <span className={`session-card__block-grade ${blockGradeClass}`}>{grade}</span>
                                                        </div>
                                                        <div className="session-card__block-meta">
                                                            <span>{t('sessions.block.set', { count: block.numberOfSets })}</span>
                                                            <span className="session-card__block-sep">·</span>
                                                            <span>{modeLabel}</span>
                                                            <span className="session-card__block-sep">·</span>
                                                            <span>{t('sessions.block.rest', { duration: formatTimeDuration(block.restBetweenSets) })}</span>
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
                    {t('sessions.view_all')}
                </button>
            )}
        </div>
    );
}
