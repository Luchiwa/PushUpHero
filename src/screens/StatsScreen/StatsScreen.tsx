import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useWeekSessions, getWeekStart, formatWeekRange } from '@hooks/useWeekSessions';
import { EXERCISE_META, getExerciseLabelKey, type ExerciseType } from '@exercises/types';
import { WeeklyChart } from './WeeklyChart/WeeklyChart';
import { SessionHistory } from '@components/SessionHistory/SessionHistory';
import { PageLayout } from '@components/PageLayout/PageLayout';
import { KPIGrid } from './KPIGrid/KPIGrid';
import { computeWeeklySummary } from './KPIGrid/computeWeeklySummary';
import { WeekNavigator } from './WeekNavigator/WeekNavigator';
import { MetricToggle } from './MetricToggle/MetricToggle';
import './StatsScreen.scss';

type ExerciseFilter = 'all' | ExerciseType;
export type MetricMode = 'xp' | 'reps';

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
    const { t } = useTranslation('stats');
    const [weekOffset, setWeekOffset] = useState(0);
    const [exerciseFilter, setExerciseFilter] = useState<ExerciseFilter>('all');
    const [metric, setMetric] = useState<MetricMode>('xp');
    const { sessions, prevSessions, loading, firstSessionDate, fetchWeek } = useWeekSessions();
    const filters: { value: ExerciseFilter; emoji: string; label: string }[] = useMemo(
        () => [
            { value: 'all', emoji: '🏋️', label: t('screen.filter_all') },
            ...EXERCISE_META.map(m => ({ value: m.type as ExerciseFilter, emoji: m.emoji, label: t(getExerciseLabelKey(m.type)) })),
        ],
        [t],
    );

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

    // Skeleton only fires when there are truly no sessions yet — avoids flicker
    // when navigating between cached weeks.
    const showSkeleton = loading && sessions.length === 0;

    const goPrev = useCallback(() => {
        if (!isPrevDisabled) setWeekOffset(w => w - 1);
    }, [isPrevDisabled]);
    const goNext = useCallback(() => {
        if (!isNextDisabled) setWeekOffset(w => w + 1);
    }, [isNextDisabled]);
    const swipeHandlers = useSwipe(goNext, goPrev);

    return (
        <PageLayout
            title={t('screen.title')}
            onClose={onClose}
            zIndex={200}
            bodyClassName="stats-body"
            rightAction={<MetricToggle metric={metric} onChange={setMetric} />}
        >
            <div className="stats-fixed-top">

                {/* Exercise type filter */}
                <div className="stats-filter-row">
                    {filters.map((f, i) => (
                        <button
                            key={f.value}
                            type="button"
                            className={`stats-filter-pill${exerciseFilter === f.value ? ' active' : ''}`}
                            style={{ animationDelay: `${i * 60}ms` }}
                            onClick={() => setExerciseFilter(f.value)}
                        >
                            <span className="stats-filter-emoji">{f.emoji}</span>
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* Week chart section */}
                <div className="stats-chart-section" {...swipeHandlers}>
                    <WeekNavigator
                        currentWeekOffset={weekOffset}
                        onPrev={goPrev}
                        onNext={goNext}
                        weekLabel={formatWeekRange(weekOffset)}
                        isPrevDisabled={isPrevDisabled}
                        isNextDisabled={isNextDisabled}
                    />

                    {!showSkeleton && (
                        <KPIGrid
                            summary={summary}
                            prevSummary={prevSummary}
                            filteredSessions={filteredSessions}
                            exerciseFilter={exerciseFilter}
                            metric={metric}
                        />
                    )}
                    {showSkeleton && (
                        <KPIGrid
                            summary={summary}
                            prevSummary={prevSummary}
                            filteredSessions={filteredSessions}
                            exerciseFilter={exerciseFilter}
                            metric={metric}
                            loading
                        />
                    )}

                    <WeeklyChart
                        sessions={filteredSessions}
                        weekOffset={weekOffset}
                        exerciseFilter={exerciseFilter}
                        metric={metric}
                        loading={showSkeleton}
                    />
                </div>

            </div>{/* end stats-fixed-top */}

            {(filteredSessions.length > 0 || !loading) && (
                <div className="stats-sessions-divider">
                    <span className="stats-sessions-divider__label">{t('screen.this_week_sessions')}</span>
                    {filteredSessions.length > 0 && (
                        <span className="stats-sessions-divider__count">{filteredSessions.length}</span>
                    )}
                </div>
            )}

            <div className="stats-sessions-scroll">
                {filteredSessions.length > 0 ? (
                    <SessionHistory sessions={filteredSessions} />
                ) : !loading && (
                    <p className="stats-sessions-empty">{t('screen.no_sessions')}</p>
                )}
            </div>
        </PageLayout>
    );
}
