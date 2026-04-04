import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useWeekSessions, getWeekStart, formatWeekRange } from '@hooks/useWeekSessions';
import type { ExerciseType } from '@exercises/types';
import { EXERCISE_META } from '@exercises/types';
import { WeeklyChart } from './WeeklyChart/WeeklyChart';
import { SessionHistoryPanel } from '@modals/panels/SessionHistoryPanel/SessionHistoryPanel';
import { PageLayout } from '@components/PageLayout/PageLayout';
import { KPIGrid } from './KPIGrid/KPIGrid';
import { computeWeeklySummary } from './KPIGrid/computeWeeklySummary';
import { WeekNavigator } from './WeekNavigator/WeekNavigator';
import './StatsScreen.scss';

type ExerciseFilter = 'all' | ExerciseType;
export type MetricMode = 'xp' | 'reps';

const FILTERS: { value: ExerciseFilter; emoji: string; label: string }[] = [
    { value: 'all', emoji: '🏋️', label: 'All' },
    ...EXERCISE_META.map(m => ({ value: m.type as ExerciseFilter, emoji: m.emoji, label: m.label })),
];

// ── Swipe hook ──────────────────────────────────────────────────
const SWIPE_THRESHOLD = 50;

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
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD) {
            if (dx < 0) onSwipeLeft();
            else onSwipeRight();
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

    const summary = useMemo(() => computeWeeklySummary(filteredSessions, exerciseFilter), [filteredSessions, exerciseFilter]);
    const prevSummary = useMemo(() => computeWeeklySummary(filteredPrevSessions, exerciseFilter), [filteredPrevSessions, exerciseFilter]);

    const isPrevDisabled = firstSessionDate === null
        || getWeekStart(weekOffset - 1).getTime() + 7 * 86_400_000 <= firstSessionDate;

    const isNextDisabled = weekOffset >= 0;

    const hasActivity = filteredSessions.some(s => s.reps > 0);

    const goPrev = useCallback(() => {
        if (!isPrevDisabled) setWeekOffset(w => w - 1);
    }, [isPrevDisabled]);
    const goNext = useCallback(() => {
        if (!isNextDisabled) setWeekOffset(w => w + 1);
    }, [isNextDisabled]);
    const swipeHandlers = useSwipe(goNext, goPrev);

    return (
        <PageLayout title="Statistics" onClose={onClose} zIndex={200} bodyClassName="stats-body">
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
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                        XP
                    </button>
                    <button
                        type="button"
                        className={`stats-metric-btn${metric === 'reps' ? ' active' : ''}`}
                        onClick={() => setMetric('reps')}
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="1 4 1 10 7 10" /><polyline points="23 20 23 14 17 14" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" /></svg>
                        Reps
                    </button>
                    <div className="stats-metric-indicator" style={{ left: metric === 'xp' ? '4px' : 'calc(50% + 2px)' }} />
                </div>

                {/* Week chart section */}
                <div className="stats-chart-section" {...swipeHandlers}>
                    <WeekNavigator
                        currentWeekOffset={weekOffset}
                        onPrev={() => setWeekOffset(w => w - 1)}
                        onNext={() => setWeekOffset(w => w + 1)}
                        weekLabel={formatWeekRange(weekOffset)}
                        isPrevDisabled={isPrevDisabled}
                        isNextDisabled={isNextDisabled}
                    />

                    {!loading && hasActivity && (
                        <KPIGrid
                            summary={summary}
                            prevSummary={prevSummary}
                            filteredSessions={filteredSessions}
                            exerciseFilter={exerciseFilter}
                            metric={metric}
                        />
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
                            <span className="stats-empty-icon">{exerciseFilter === 'all' ? '🏖️' : '🔍'}</span>
                            <p className="stats-empty-title">{weekOffset === 0 ? 'No activity yet this week' : 'Rest week'}</p>
                            <p className="stats-empty-sub">{exerciseFilter === 'all' ? 'Complete a session to see your chart' : 'No matching sessions this week'}</p>
                        </div>
                    )}
                </div>

                </div>{/* end stats-fixed-top */}

                {(filteredSessions.length > 0 || !loading) && (
                    <div className="stats-sessions-divider">
                        <span>Sessions</span>
                    </div>
                )}

                <div className="stats-sessions-scroll">
                    {filteredSessions.length > 0 ? (
                        <SessionHistoryPanel sessions={filteredSessions} />
                    ) : !loading && (
                        <p className="stats-sessions-empty">No sessions to display.</p>
                    )}
                </div>
        </PageLayout>
    );
}
