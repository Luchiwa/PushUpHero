import type { CSSProperties } from 'react';
import type { SessionRecord } from '@exercises/types';
import { compactNum, pctChange, type ExerciseFilter } from '@domain';
import type { MetricMode } from '../StatsScreen';
import type { WeeklySummary } from './computeWeeklySummary';
import './KPIGrid.scss';

// CSS var refs for per-tile gradient/border tint via `--kpi-color`.
const KPI_COLOR: Record<string, string> = {
    accent: 'var(--ember)',
    amber: 'var(--gold)',
    indigo: 'var(--purple)',
    orange: 'var(--ice)',
};

interface KPIGridProps {
    summary: WeeklySummary;
    prevSummary: WeeklySummary;
    filteredSessions: SessionRecord[];
    exerciseFilter: ExerciseFilter;
    metric: MetricMode;
    loading?: boolean;
}

export function KPIGrid({ summary, prevSummary, filteredSessions, exerciseFilter, metric, loading }: KPIGridProps) {
    if (loading) {
        return (
            <div className="stats-summary-grid">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="stats-kpi stats-kpi--skeleton" />
                ))}
            </div>
        );
    }

    interface KpiDef { icon: string; iconColor: keyof typeof KPI_COLOR; label: string; value: string; change: number | null }
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
            {kpis.map((k, i) => {
                const tileStyle = {
                    '--kpi-color': KPI_COLOR[k.iconColor],
                    animationDelay: `${i * 50}ms`,
                } as CSSProperties;
                return (
                    <div key={k.label} className="stats-kpi" style={tileStyle}>
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
                );
            })}
        </div>
    );
}
