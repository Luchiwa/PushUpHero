import type { SessionRecord } from '@exercises/types';
import type { MetricMode } from '../StatsScreen';
import './KPIGrid.scss';

type ExerciseFilter = 'all' | import('@exercises/types').ExerciseType;

interface WeeklySummary {
    totalXp: number;
    totalReps: number;
    sessionCount: number;
    activeDays: number;
    bestSession: number;
}

function compactNum(n: number): string {
    if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`;
    return n.toLocaleString();
}

function pctChange(current: number, previous: number): number | null {
    if (previous === 0 && current === 0) return null;
    if (previous === 0) return 100;
    return Math.round(((current - previous) / previous) * 100);
}

export function computeWeeklySummary(
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

        if (exerciseFilter !== 'all' && s.xpPerExercise) {
            const match = s.xpPerExercise.find(e => e.exerciseType === exerciseFilter);
            if (match) totalXp += match.finalXp;
            if (match && match.finalXp > bestXp) bestXp = match.finalXp;
        } else {
            totalXp += s.xpEarned ?? 0;
            if ((s.xpEarned ?? 0) > bestXp) bestXp = s.xpEarned ?? 0;
        }

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
        bestSession: bestReps,
    };
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
