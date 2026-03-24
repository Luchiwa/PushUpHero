import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useWeekSessions, getWeekStart, formatWeekRange } from '@hooks/useWeekSessions';
import type { ExerciseType } from '@exercises/types';
import type { SessionRecord } from '@hooks/useSessionHistory';
import { WeeklyChart } from './WeeklyChart';
import { SessionHistoryPanel } from '@modals/panels/SessionHistoryPanel/SessionHistoryPanel';
import './StatsScreen.scss';
import './WeeklyChart.scss';

type ExerciseFilter = 'all' | ExerciseType;
export type MetricMode = 'xp' | 'reps';

const FILTERS: { value: ExerciseFilter; emoji: string; label: string }[] = [
    { value: 'all', emoji: '🏋️', label: 'All' },
    { value: 'pushup', emoji: '💪', label: 'Push-ups' },
    { value: 'squat', emoji: '🦵', label: 'Squats' },
];

// ── Weekly Summary helpers ──────────────────────────────────────
interface WeeklySummary {
    totalXp: number;
    totalReps: number;
    sessionCount: number;
    activeDays: number;
    bestSession: number; // best reps or best XP depending on metric
}

function computeWeeklySummary(
    sessions: SessionRecord[],
    exerciseFilter: ExerciseFilter,
): WeeklySummary {
    let totalXp = 0;
    let totalReps = 0;
    let bestXp = 0;
    let bestReps = 0;
    const activeDaysSet = new Set<number>();

    for (const s of sessions) {
        const day = new Date(s.date).getDay();
        activeDaysSet.add(day);

        // XP
        if (exerciseFilter !== 'all' && s.xpPerExercise) {
            const match = s.xpPerExercise.find(e => e.exerciseType === exerciseFilter);
            if (match) totalXp += match.finalXp;
            if (match && match.finalXp > bestXp) bestXp = match.finalXp;
        } else {
            totalXp += s.xpEarned ?? 0;
            if ((s.xpEarned ?? 0) > bestXp) bestXp = s.xpEarned ?? 0;
        }

        // Reps
        if (exerciseFilter !== 'all' && s.isMultiExercise && s.blocks && s.sets) {
            let setIdx = 0;
            let sessionReps = 0;
            for (const block of s.blocks) {
                const blockSets = s.sets.slice(setIdx, setIdx + block.numberOfSets);
                setIdx += block.numberOfSets;
                if (block.exerciseType === exerciseFilter) {
                    sessionReps += blockSets.reduce((sum, st) => sum + st.reps, 0);
                }
            }
            totalReps += sessionReps;
            if (sessionReps > bestReps) bestReps = sessionReps;
        } else {
            totalReps += s.reps;
            if (s.reps > bestReps) bestReps = s.reps;
        }
    }

    return {
        totalXp,
        totalReps,
        sessionCount: sessions.length,
        activeDays: activeDaysSet.size,
        bestSession: bestReps, // best reps for the "best" KPI; we'll pick metric-based in render
    };
}

/** Format a number compactly: 1234 → "1.2k" */
function compactNum(n: number): string {
    if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`;
    return n.toLocaleString();
}

/** Compute percentage change, capped at ±999 */
function pctChange(current: number, previous: number): number | null {
    if (previous === 0 && current === 0) return null;
    if (previous === 0) return 100; // went from 0 → something = +100%
    return Math.round(((current - previous) / previous) * 100);
}

// ── Swipe hook ──────────────────────────────────────────────────
const SWIPE_THRESHOLD = 50; // px minimum distance to trigger

function useSwipe(onSwipeLeft: () => void, onSwipeRight: () => void) {
    const touchStart = useRef<{ x: number; y: number } | null>(null);
    const touchEnd = useRef<{ x: number; y: number } | null>(null);

    const onTouchStart = useCallback((e: React.TouchEvent) => {
        touchEnd.current = null;
        touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, []);

    const onTouchMove = useCallback((e: React.TouchEvent) => {
        touchEnd.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, []);

    const onTouchEnd = useCallback(() => {
        if (!touchStart.current || !touchEnd.current) return;
        const dx = touchEnd.current.x - touchStart.current.x;
        const dy = touchEnd.current.y - touchStart.current.y;
        // Only trigger if horizontal movement > vertical (avoid scroll conflict)
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD) {
            if (dx < 0) onSwipeLeft();   // swipe left → next week
            else onSwipeRight();          // swipe right → prev week
        }
        touchStart.current = null;
        touchEnd.current = null;
    }, [onSwipeLeft, onSwipeRight]);

    return { onTouchStart, onTouchMove, onTouchEnd };
}

interface StatsScreenProps {
    onClose: () => void;
}

export function StatsScreen({ onClose }: StatsScreenProps) {
    const [weekOffset, setWeekOffset] = useState(0);
    const [exerciseFilter, setExerciseFilter] = useState<ExerciseFilter>('all');
    const [metric, setMetric] = useState<MetricMode>('xp');
    const { sessions, prevSessions, loading, firstSessionDate, fetchWeek } = useWeekSessions();

    useEffect(() => {
        fetchWeek(weekOffset);
    }, [weekOffset, fetchWeek]);

    const filteredSessions = useMemo(
        () => exerciseFilter === 'all'
            ? sessions
            : sessions.filter(s => {
                // Multi-exercise sessions: include if any block matches the filter
                if (s.isMultiExercise && s.blocks) {
                    return s.blocks.some(b => b.exerciseType === exerciseFilter);
                }
                return (s.exerciseType ?? 'pushup') === exerciseFilter;
            }),
        [sessions, exerciseFilter],
    );

    const filteredPrevSessions = useMemo(
        () => exerciseFilter === 'all'
            ? prevSessions
            : prevSessions.filter(s => {
                if (s.isMultiExercise && s.blocks) {
                    return s.blocks.some(b => b.exerciseType === exerciseFilter);
                }
                return (s.exerciseType ?? 'pushup') === exerciseFilter;
            }),
        [prevSessions, exerciseFilter],
    );

    // Weekly summary KPIs + comparison with previous week
    const summary = useMemo(() => computeWeeklySummary(filteredSessions, exerciseFilter), [filteredSessions, exerciseFilter]);
    const prevSummary = useMemo(() => computeWeeklySummary(filteredPrevSessions, exerciseFilter), [filteredPrevSessions, exerciseFilter]);

    const isPrevDisabled = firstSessionDate === null
        || getWeekStart(weekOffset - 1).getTime() + 7 * 86_400_000 <= firstSessionDate;

    const isNextDisabled = weekOffset >= 0;

    const hasActivity = filteredSessions.some(s => s.reps > 0);

    // Swipe to navigate weeks
    const goPrev = useCallback(() => {
        if (!isPrevDisabled) setWeekOffset(w => w - 1);
    }, [isPrevDisabled]);
    const goNext = useCallback(() => {
        if (!isNextDisabled) setWeekOffset(w => w + 1);
    }, [isNextDisabled]);
    const swipeHandlers = useSwipe(goNext, goPrev); // swipe left = next, swipe right = prev

    return (
        <div className="stats-screen">
            {/* Top bar */}
            <div className="stats-topbar">
                <button type="button" className="btn-icon stats-back-btn" onClick={onClose} aria-label="Back">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>
                <span className="stats-topbar-title">Statistics</span>
                <div style={{ width: 40 }} />
            </div>

            <div className="stats-body">
                <div className="stats-fixed-top">

                {/* Exercise type filter */}
                <div className="stats-filter-row">
                    {FILTERS.map(f => (
                        <button
                            key={f.value}
                            type="button"
                            className={`stats-filter-pill${exerciseFilter === f.value ? ' active' : ''}`}
                            onClick={() => setExerciseFilter(f.value)}
                        >
                            <span className="stats-filter-emoji">{f.emoji}</span>
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* Metric toggle: XP / Reps */}
                <div className="stats-metric-toggle">
                    <button
                        type="button"
                        className={`stats-metric-btn${metric === 'xp' ? ' active' : ''}`}
                        onClick={() => setMetric('xp')}
                    >
                        ⚡ XP
                    </button>
                    <button
                        type="button"
                        className={`stats-metric-btn${metric === 'reps' ? ' active' : ''}`}
                        onClick={() => setMetric('reps')}
                    >
                        🔄 Reps
                    </button>
                </div>

                {/* Week chart section */}
                <div className="stats-chart-section" {...swipeHandlers}>
                    {/* Week navigation header */}
                    <div className="stats-week-nav">
                        <button
                            type="button"
                            className="btn-icon stats-nav-btn"
                            onClick={() => setWeekOffset(w => w - 1)}
                            disabled={isPrevDisabled}
                            aria-label="Previous week"
                        >
                            ‹
                        </button>
                        <span className="stats-week-label">{formatWeekRange(weekOffset)}</span>
                        <button
                            type="button"
                            className="btn-icon stats-nav-btn"
                            onClick={() => setWeekOffset(w => w + 1)}
                            disabled={isNextDisabled}
                            aria-label="Next week"
                        >
                            ›
                        </button>
                    </div>

                    {/* Weekly summary KPIs */}
                    {!loading && hasActivity && (
                        <div className="stats-summary-grid">
                            {(() => {
                                const kpis: { emoji: string; label: string; value: string; change: number | null }[] = metric === 'xp'
                                    ? [
                                        { emoji: '⚡', label: 'XP', value: compactNum(summary.totalXp), change: pctChange(summary.totalXp, prevSummary.totalXp) },
                                        { emoji: '🏆', label: 'Best', value: compactNum(Math.max(...filteredSessions.map(s => {
                                            if (exerciseFilter !== 'all' && s.xpPerExercise) {
                                                const m = s.xpPerExercise.find(e => e.exerciseType === exerciseFilter);
                                                return m ? m.finalXp : 0;
                                            }
                                            return s.xpEarned ?? 0;
                                        }))), change: null },
                                    ]
                                    : [
                                        { emoji: '💪', label: 'Reps', value: compactNum(summary.totalReps), change: pctChange(summary.totalReps, prevSummary.totalReps) },
                                        { emoji: '🏆', label: 'Best', value: compactNum(summary.bestSession), change: null },
                                    ];

                                kpis.push(
                                    { emoji: '📋', label: 'Sessions', value: String(summary.sessionCount), change: pctChange(summary.sessionCount, prevSummary.sessionCount) },
                                    { emoji: '🔥', label: 'Active', value: `${summary.activeDays}/7`, change: null },
                                );

                                return kpis.map(k => (
                                    <div key={k.label} className="stats-kpi">
                                        <span className="stats-kpi-emoji">{k.emoji}</span>
                                        <span className="stats-kpi-value">
                                            {k.value}
                                            {k.change !== null && k.change !== 0 && (
                                                <span className={`stats-kpi-change ${k.change > 0 ? 'up' : 'down'}`}>
                                                    {k.change > 0 ? '↑' : '↓'}{Math.abs(k.change)}%
                                                </span>
                                            )}
                                        </span>
                                        <span className="stats-kpi-label">{k.label}</span>
                                    </div>
                                ));
                            })()}
                        </div>
                    )}

                    {/* Chart or empty state */}
                    {loading ? (
                        <div className="stats-chart-placeholder">
                            <span className="stats-loading-dot" />
                        </div>
                    ) : hasActivity ? (
                        <div className="stats-chart-wrap">
                            <WeeklyChart sessions={filteredSessions} weekOffset={weekOffset} exerciseFilter={exerciseFilter} metric={metric} />
                        </div>
                    ) : (
                        <div className="stats-empty-week">
                            <span className="stats-empty-icon">🏖️</span>
                            <p>{exerciseFilter === 'all' ? 'No activity this week' : 'No matching sessions'}</p>
                        </div>
                    )}
                </div>

                </div>{/* end stats-fixed-top */}

                {/* Titre fixe hors scroll */}
                {(filteredSessions.length > 0 || !loading) && (
                    <p className="stats-sessions-title">This week's sessions</p>
                )}

                {/* Session list — seule zone scrollable */}
                <div className="stats-sessions-scroll">
                    {filteredSessions.length > 0 ? (
                        <SessionHistoryPanel sessions={filteredSessions} />
                    ) : !loading && (
                        <p className="stats-sessions-empty">No sessions to display.</p>
                    )}
                </div>
            </div>{/* end stats-body */}
        </div>
    );
}
