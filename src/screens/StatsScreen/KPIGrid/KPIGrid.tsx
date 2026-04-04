import type { SessionRecord } from '@exercises/types';
import type { MetricMode } from '../StatsScreen';
import type { WeeklySummary } from './computeWeeklySummary';
import './KPIGrid.scss';

type ExerciseFilter = 'all' | import('@exercises/types').ExerciseType;

function compactNum(n: number): string {
    if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`;
    return n.toLocaleString();
}

function pctChange(current: number, previous: number): number | null {
    if (previous === 0 && current === 0) return null;
    if (previous === 0) return 100;
    return Math.round(((current - previous) / previous) * 100);
}

interface KPIGridProps {
    summary: WeeklySummary;
    prevSummary: WeeklySummary;
    filteredSessions: SessionRecord[];
    exerciseFilter: ExerciseFilter;
    metric: MetricMode;
}

export function KPIGrid({ summary, prevSummary, filteredSessions, exerciseFilter, metric }: KPIGridProps) {
    interface KpiDef { icon: string; iconColor: string; label: string; value: string; change: number | null }
    const kpis: KpiDef[] = metric === 'xp'
        ? [
            { icon: '⚡', iconColor: 'accent', label: 'XP', value: compactNum(summary.totalXp), change: pctChange(summary.totalXp, prevSummary.totalXp) },
            { icon: '🏆', iconColor: 'amber', label: 'Best', value: compactNum(Math.max(0, ...filteredSessions.map(s => {
                if (exerciseFilter !== 'all' && s.xpPerExercise) {
                    const m = s.xpPerExercise.find(e => e.exerciseType === exerciseFilter);
                    return m ? m.finalXp : 0;
                }
                return s.xpEarned ?? 0;
            }))), change: null },
        ]
        : [
            { icon: '💪', iconColor: 'accent', label: 'Reps', value: compactNum(summary.totalReps), change: pctChange(summary.totalReps, prevSummary.totalReps) },
            { icon: '🏆', iconColor: 'amber', label: 'Best', value: compactNum(summary.bestSession), change: null },
        ];

    kpis.push(
        { icon: '📋', iconColor: 'indigo', label: 'Sessions', value: String(summary.sessionCount), change: pctChange(summary.sessionCount, prevSummary.sessionCount) },
        { icon: '🔥', iconColor: 'orange', label: 'Active', value: `${summary.activeDays}/7`, change: null },
    );

    return (
        <div className="stats-summary-grid">
            {kpis.map(k => (
                <div key={k.label} className={`stats-kpi stats-kpi--${k.iconColor}`}>
                    <span className="stats-kpi-icon">{k.icon}</span>
                    <span className="stats-kpi-value">
                        {k.value}
                        {k.change !== null && k.change !== 0 && (
                            <span className={`stats-kpi-change ${k.change > 0 ? 'up' : 'down'}`}>
                                {k.change > 0 ? '▲' : '▼'}{Math.abs(k.change)}%
                            </span>
                        )}
                    </span>
                    <span className="stats-kpi-label">{k.label}</span>
                </div>
            ))}
        </div>
    );
}
