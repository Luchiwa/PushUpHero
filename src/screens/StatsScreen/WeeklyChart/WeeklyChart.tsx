import { useState, useRef } from 'react';
import type { SessionRecord } from '@exercises/types';
import type { ExerciseType } from '@exercises/types';
import './WeeklyChart.scss';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CHART_W = 320;
const CHART_H = 150;
const PAD_LEFT = 48;
const PAD_RIGHT = 16;
const PAD_TOP = 22;
const PAD_BOTTOM = 30;
const PLOT_W = CHART_W - PAD_LEFT - PAD_RIGHT;
const PLOT_H = CHART_H - PAD_TOP - PAD_BOTTOM;

type ExerciseFilter = 'all' | ExerciseType;
type MetricMode = 'xp' | 'reps';

interface Props {
    sessions: SessionRecord[];
    weekOffset: number;  // 0 = current week
    exerciseFilter?: ExerciseFilter;
    metric?: MetricMode;
}

/**
 * Count reps per day, respecting the exercise filter.
 * For multi-exercise sessions filtered by type, only count reps from matching blocks.
 */
function buildDayTotals(sessions: SessionRecord[], weekOffset: number, exerciseFilter: ExerciseFilter = 'all'): number[] {
    const totals = [0, 0, 0, 0, 0, 0, 0];
    // Sunday of the displayed week at local midnight
    const now = new Date();
    const todayDay = now.getDay();
    const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - todayDay + weekOffset * 7);

    sessions.forEach(s => {
        const d = new Date(s.date);
        const localDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const diff = Math.round((localDay.getTime() - sunday.getTime()) / 86_400_000);
        if (diff < 0 || diff > 6) return;

        // For multi-exercise sessions with a specific filter, count only matching block reps
        if (exerciseFilter !== 'all' && s.isMultiExercise && s.blocks && s.sets) {
            let setIdx = 0;
            for (const block of s.blocks) {
                const blockSets = s.sets.slice(setIdx, setIdx + block.numberOfSets);
                setIdx += block.numberOfSets;
                if (block.exerciseType === exerciseFilter) {
                    totals[diff] += blockSets.reduce((sum, st) => sum + st.reps, 0);
                }
            }
        } else {
            totals[diff] += s.reps;
        }
    });
    return totals;
}

/**
 * Sum XP per day. Uses xpEarned from each session.
 * For filtered exercises, uses xpPerExercise breakdown when available.
 */
function buildDayTotalsXp(sessions: SessionRecord[], weekOffset: number, exerciseFilter: ExerciseFilter = 'all'): number[] {
    const totals = [0, 0, 0, 0, 0, 0, 0];
    const now = new Date();
    const todayDay = now.getDay();
    const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - todayDay + weekOffset * 7);

    sessions.forEach(s => {
        const d = new Date(s.date);
        const localDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const diff = Math.round((localDay.getTime() - sunday.getTime()) / 86_400_000);
        if (diff < 0 || diff > 6) return;

        if (exerciseFilter !== 'all' && s.xpPerExercise) {
            // Only count XP from the matching exercise type
            const match = s.xpPerExercise.find(e => e.exerciseType === exerciseFilter);
            if (match) totals[diff] += match.finalXp;
        } else {
            totals[diff] += s.xpEarned ?? 0;
        }
    });
    return totals;
}

function niceMax(value: number): number {
    if (value <= 0) return 10;
    const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
    const normalized = value / magnitude;
    const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    return nice * magnitude;
}

export function WeeklyChart({ sessions, weekOffset, exerciseFilter, metric = 'xp' }: Props) {
    const totals = metric === 'xp'
        ? buildDayTotalsXp(sessions, weekOffset, exerciseFilter)
        : buildDayTotals(sessions, weekOffset, exerciseFilter);
    const maxReps = niceMax(Math.max(...totals));
    const metricLabel = metric === 'xp' ? 'XP' : 'reps';

    // Today's day index (0–6), only relevant for current week
    const todayIndex = weekOffset === 0 ? new Date().getDay() : -1;

    // Tooltip state
    const [tooltip, setTooltip] = useState<{ x: number; y: number; day: number; reps: number } | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);

    const xFor = (i: number) => PAD_LEFT + (i / 6) * PLOT_W;
    const yFor = (v: number) => PAD_TOP + PLOT_H - (v / maxReps) * PLOT_H;

    // Build the line path and closed fill path
    const points = totals.map((v, i) => ({ x: xFor(i), y: yFor(v) }));
    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const fillPath = `${linePath} L${xFor(6).toFixed(1)},${(PAD_TOP + PLOT_H).toFixed(1)} L${xFor(0).toFixed(1)},${(PAD_TOP + PLOT_H).toFixed(1)} Z`;

    // Y-axis grid lines (4 ticks)
    const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({
        value: Math.round(maxReps * f),
        y: yFor(maxReps * f),
    }));

    const handleTouch = (e: React.TouchEvent<SVGSVGElement>) => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return;
        const clientX = e.touches[0].clientX;
        const relX = (clientX - rect.left) / rect.width * CHART_W;
        const closest = Math.round(((relX - PAD_LEFT) / PLOT_W) * 6);
        const idx = Math.max(0, Math.min(6, closest));
        setTooltip({ x: xFor(idx), y: yFor(totals[idx]), day: idx, reps: totals[idx] });
    };

    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return;
        const relX = (e.clientX - rect.left) / rect.width * CHART_W;
        const closest = Math.round(((relX - PAD_LEFT) / PLOT_W) * 6);
        const idx = Math.max(0, Math.min(6, closest));
        setTooltip({ x: xFor(idx), y: yFor(totals[idx]), day: idx, reps: totals[idx] });
    };

    return (
        <svg
            ref={svgRef}
            className="weekly-chart"
            viewBox={`0 0 ${CHART_W} ${CHART_H}`}
            preserveAspectRatio="xMidYMid meet"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setTooltip(null)}
            onTouchStart={handleTouch}
            onTouchMove={handleTouch}
            onTouchEnd={() => setTooltip(null)}
        >
            <defs>
                <linearGradient id="chart-fill-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
                </linearGradient>
            </defs>

            {/* Y-axis grid lines + labels */}
            {yTicks.map(tick => (
                <g key={tick.value}>
                    <line
                        x1={PAD_LEFT} y1={tick.y}
                        x2={CHART_W - PAD_RIGHT} y2={tick.y}
                        stroke="#e5e7eb" strokeWidth="1"
                    />
                    <text
                        x={PAD_LEFT - 8} y={tick.y + 4}
                        textAnchor="end"
                        className="chart-axis-label"
                    >
                        {tick.value}
                    </text>
                </g>
            ))}

            {/* Fill area */}
            <path d={fillPath} fill="url(#chart-fill-gradient)" />

            {/* Line */}
            <path d={linePath} fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

            {/* Day labels + today highlight */}
            {totals.map((_, i) => {
                const cx = xFor(i);
                const isToday = i === todayIndex;
                return (
                    <g key={i}>
                        {isToday && (
                            <text
                                x={cx} y={PAD_TOP - 8}
                                textAnchor="middle"
                                className="chart-today-label"
                            >
                                Today
                            </text>
                        )}
                        <text
                            x={cx}
                            y={PAD_TOP + PLOT_H + 16}
                            textAnchor="middle"
                            className={`chart-day-label${isToday ? ' chart-day-label--today' : ''}`}
                        >
                            {DAY_LABELS[i]}
                        </text>
                    </g>
                );
            })}

            {/* Data points */}
            {points.map((p, i) => {
                const isToday = i === todayIndex;
                const hasData = totals[i] > 0;
                if (!hasData && !isToday) return null;
                return (
                    <circle
                        key={i}
                        cx={p.x} cy={p.y} r={isToday ? 5 : 3.5}
                        fill={isToday ? '#f97316' : '#fff'}
                        stroke="#f97316"
                        strokeWidth="2"
                    />
                );
            })}

            {/* Tooltip */}
            {tooltip && (() => {
                const RECT_W = metric === 'xp' ? 72 : 58;
                const RECT_H = 22;
                // Centre horizontal : clamp pour rester dans le SVG
                const tx = Math.max(RECT_W / 2 + 2, Math.min(CHART_W - RECT_W / 2 - 2, tooltip.x));
                // Haut du rect : au-dessus du point de données
                const rectY = Math.max(2, tooltip.y - RECT_H - 10);
                // Centre vertical du rect pour le texte
                const textY = rectY + RECT_H / 2;
                return (
                    <g className="chart-tooltip">
                        <rect
                            x={tx - RECT_W / 2} y={rectY}
                            width={RECT_W} height={RECT_H}
                            rx={6}
                            fill="#1a1a1a"
                            opacity={0.88}
                        />
                        <text
                            x={tx} y={textY}
                            textAnchor="middle"
                            dominantBaseline="central"
                            className="chart-tooltip-text"
                        >
                            {tooltip.reps.toLocaleString()} {metricLabel}
                        </text>
                    </g>
                );
            })()}
        </svg>
    );
}
