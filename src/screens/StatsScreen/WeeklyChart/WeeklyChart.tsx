import { useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { SessionRecord } from '@exercises/types';
import { buildDayTotals, buildDayTotalsXp, niceMax, type ExerciseFilter } from '@domain';
import './WeeklyChart.scss';

// Day labels stay as English short codes for the chart axis — keeping a
// fixed 3-letter form across languages avoids overflowing the tiny tick
// space (FR full names are too long). Localizable swap deferred to commit 6.
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LABELS_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const CHART_W = 320;
const CHART_H = 150;
const PAD_LEFT = 44;
const PAD_RIGHT = 16;
const PAD_TOP = 22;
const PAD_BOTTOM = 30;
const PLOT_W = CHART_W - PAD_LEFT - PAD_RIGHT;
const PLOT_H = CHART_H - PAD_TOP - PAD_BOTTOM;

type MetricMode = 'xp' | 'reps';

interface Props {
    sessions: SessionRecord[];
    weekOffset: number;  // 0 = current week
    exerciseFilter?: ExerciseFilter;
    metric?: MetricMode;
    loading?: boolean;
}

export function WeeklyChart({ sessions, weekOffset, exerciseFilter = 'all', metric = 'xp', loading }: Props) {
    const { t } = useTranslation('stats');
    // Tooltip state — declared first so hook order stays stable across renders.
    const [tooltip, setTooltip] = useState<{ x: number; y: number; day: number; value: number } | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);

    const totals = metric === 'xp'
        ? buildDayTotalsXp(sessions, weekOffset, exerciseFilter)
        : buildDayTotals(sessions, weekOffset, exerciseFilter);
    const maxReps = niceMax(Math.max(...totals));
    const metricLabel = metric === 'xp' ? t('screen.chart_metric_xp') : t('screen.chart_metric_reps');
    const headerLabel = metric === 'xp' ? t('screen.chart_label_xp') : t('screen.chart_label_reps');
    const totalForWeek = totals.reduce((sum, v) => sum + v, 0);
    const hasAnyData = totalForWeek > 0;

    // Today's day index (0–6), only relevant for current week
    const todayIndex = weekOffset === 0 ? new Date().getDay() : -1;

    const xFor = (i: number) => PAD_LEFT + (i / 6) * PLOT_W;
    const yFor = (v: number) => PAD_TOP + PLOT_H - (v / maxReps) * PLOT_H;

    // Build the line + fill paths (memoized so the draw animation `key` is stable
    // unless the actual chart geometry changes).
    const totalsKey = totals.join(',');
    const { linePath, fillPath, points, pathKey } = useMemo(() => {
        const pts = totals.map((v, i) => ({ x: xFor(i), y: yFor(v) }));
        const lp = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
        const fp = `${lp} L${xFor(6).toFixed(1)},${(PAD_TOP + PLOT_H).toFixed(1)} L${xFor(0).toFixed(1)},${(PAD_TOP + PLOT_H).toFixed(1)} Z`;
        const key = `${weekOffset}|${metric}|${exerciseFilter}|${totalsKey}`;
        return { linePath: lp, fillPath: fp, points: pts, pathKey: key };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [weekOffset, metric, exerciseFilter, totalsKey]);

    // ── Loading skeleton (after all hooks have been called) ────
    if (loading) {
        return (
            <div className="stats-chart-card stats-chart-card--loading">
                <div className="stats-chart-card__header">
                    <span className="stats-chart-card__label">{headerLabel}</span>
                </div>
                <div className="stats-chart-card__skeleton">
                    {[40, 70, 30, 90, 55, 75, 25].map((h, i) => (
                        <span key={i} className="stats-chart-skel-bar" style={{ height: `${h}%` }} />
                    ))}
                </div>
            </div>
        );
    }

    // 3 yTicks (max, mid, 0); only label max + 0.
    const yTicks = [
        { value: maxReps, y: yFor(maxReps), label: true },
        { value: Math.round(maxReps / 2), y: yFor(maxReps / 2), label: false },
        { value: 0, y: yFor(0), label: true },
    ];

    const handleTouch = (e: React.TouchEvent<SVGSVGElement>) => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return;
        const clientX = e.touches[0].clientX;
        const relX = (clientX - rect.left) / rect.width * CHART_W;
        const closest = Math.round(((relX - PAD_LEFT) / PLOT_W) * 6);
        const idx = Math.max(0, Math.min(6, closest));
        setTooltip({ x: xFor(idx), y: yFor(totals[idx]), day: idx, value: totals[idx] });
    };

    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return;
        const relX = (e.clientX - rect.left) / rect.width * CHART_W;
        const closest = Math.round(((relX - PAD_LEFT) / PLOT_W) * 6);
        const idx = Math.max(0, Math.min(6, closest));
        setTooltip({ x: xFor(idx), y: yFor(totals[idx]), day: idx, value: totals[idx] });
    };

    return (
        <div className="stats-chart-card">
            {/* ── Header strip ───────────────────────────────────── */}
            <div className="stats-chart-card__header">
                <span className="stats-chart-card__label">{headerLabel}</span>
                <span className="stats-chart-card__total">
                    {hasAnyData ? `${totalForWeek.toLocaleString()} ${metricLabel}` : '—'}
                </span>
            </div>

            {/* ── SVG chart ──────────────────────────────────────── */}
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
                        <stop offset="0%" className="chart-fill-stop-start" />
                        <stop offset="100%" className="chart-fill-stop-end" />
                    </linearGradient>
                </defs>

                {/* Y-axis grid lines + labels (only max + 0 are labelled) */}
                {yTicks.map((tick, i) => (
                    <g key={i}>
                        <line
                            x1={PAD_LEFT} y1={tick.y}
                            x2={CHART_W - PAD_RIGHT} y2={tick.y}
                            className="chart-gridline"
                        />
                        {tick.label && (
                            <text
                                x={PAD_LEFT - 8} y={tick.y + 4}
                                textAnchor="end"
                                className="chart-axis-label"
                            >
                                {tick.value}
                            </text>
                        )}
                    </g>
                ))}

                {/* Fill area */}
                <path key={`fill-${pathKey}`} className="chart-fill" d={fillPath} fill="url(#chart-fill-gradient)" />

                {/* Line — animated draw via stroke-dasharray, re-fires on pathKey change */}
                <path
                    key={`line-${pathKey}`}
                    className="chart-line"
                    d={linePath}
                    fill="none"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                />

                {/* Day labels + today highlight */}
                {totals.map((_, i) => {
                    const cx = xFor(i);
                    const isToday = i === todayIndex;
                    return (
                        <g key={i}>
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

                {/* Today's pulsing halo (behind the dot) */}
                {todayIndex >= 0 && (
                    <circle
                        className="chart-today-halo"
                        cx={xFor(todayIndex)}
                        cy={yFor(totals[todayIndex])}
                        r="6"
                        fill="none"
                        strokeWidth="2"
                    />
                )}

                {/* Data points */}
                {points.map((p, i) => {
                    const isToday = i === todayIndex;
                    const hasData = totals[i] > 0;
                    if (!hasData && !isToday) return null;
                    return (
                        <circle
                            key={i}
                            cx={p.x} cy={p.y} r={isToday ? 5 : 3.5}
                            strokeWidth="2"
                            className={`chart-dot${isToday ? ' chart-dot--today' : ''}`}
                        />
                    );
                })}

                {/* Modern tooltip — pure SVG so it never clips */}
                {tooltip && (() => {
                    const RECT_W = 70;
                    const RECT_H = 32;
                    const tx = Math.max(RECT_W / 2 + 4, Math.min(CHART_W - RECT_W / 2 - 4, tooltip.x));
                    const rectY = Math.max(2, tooltip.y - RECT_H - 12);
                    const dayY = rectY + 12;
                    const valueY = rectY + 24;
                    const caretX = tooltip.x;
                    const caretY = rectY + RECT_H;
                    return (
                        <g className="chart-tooltip">
                            <rect
                                x={tx - RECT_W / 2} y={rectY}
                                width={RECT_W} height={RECT_H}
                                rx={7}
                                className="chart-tooltip-bg"
                            />
                            {/* Caret triangle pointing toward the dot */}
                            <polygon
                                className="chart-tooltip-caret"
                                points={`${caretX - 4},${caretY} ${caretX + 4},${caretY} ${caretX},${caretY + 5}`}
                            />
                            <text
                                x={tx} y={dayY}
                                textAnchor="middle"
                                dominantBaseline="central"
                                className="chart-tooltip-day"
                            >
                                {DAY_LABELS_SHORT[tooltip.day]}
                            </text>
                            <text
                                x={tx} y={valueY}
                                textAnchor="middle"
                                dominantBaseline="central"
                                className="chart-tooltip-value"
                            >
                                {tooltip.value.toLocaleString()} {metricLabel}
                            </text>
                        </g>
                    );
                })()}
            </svg>

            {/* ── Empty state overlay (no activity at all this week) ─ */}
            {!hasAnyData && (
                <div className="stats-chart-card__empty">
                    <span className="stats-chart-card__empty-icon">{exerciseFilter === 'all' ? '🏖️' : '🔍'}</span>
                    <p className="stats-chart-card__empty-text">
                        {weekOffset === 0 ? t('screen.chart_empty_no_filter') : t('screen.chart_empty_with_filter')}
                    </p>
                </div>
            )}
        </div>
    );
}
