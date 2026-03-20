import { useEffect, useMemo, useState } from 'react';
import { useWeekSessions, getWeekStart, formatWeekRange } from '@hooks/useWeekSessions';
import type { ExerciseType } from '@exercises/types';
import { WeeklyChart } from './WeeklyChart';
import { SessionHistoryPanel } from '@modals/panels/SessionHistoryPanel/SessionHistoryPanel';
import './StatsScreen.scss';
import './WeeklyChart.scss';

type ExerciseFilter = 'all' | ExerciseType;

const FILTERS: { value: ExerciseFilter; emoji: string; label: string }[] = [
    { value: 'all', emoji: '🏋️', label: 'All' },
    { value: 'pushup', emoji: '💪', label: 'Push-ups' },
    { value: 'squat', emoji: '🦵', label: 'Squats' },
];

interface StatsScreenProps {
    onClose: () => void;
}

export function StatsScreen({ onClose }: StatsScreenProps) {
    const [weekOffset, setWeekOffset] = useState(0);
    const [exerciseFilter, setExerciseFilter] = useState<ExerciseFilter>('all');
    const { sessions, loading, firstSessionDate, fetchWeek } = useWeekSessions();

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

    const isPrevDisabled = firstSessionDate === null
        || getWeekStart(weekOffset - 1).getTime() + 7 * 86_400_000 <= firstSessionDate;

    const isNextDisabled = weekOffset >= 0;

    const hasActivity = filteredSessions.some(s => s.reps > 0);

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

                {/* Week chart section */}
                <div className="stats-chart-section">
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

                    {/* Chart or empty state */}
                    {loading ? (
                        <div className="stats-chart-placeholder">
                            <span className="stats-loading-dot" />
                        </div>
                    ) : hasActivity ? (
                        <div className="stats-chart-wrap">
                            <WeeklyChart sessions={filteredSessions} weekOffset={weekOffset} exerciseFilter={exerciseFilter} />
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
