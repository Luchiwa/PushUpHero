import './StatsWidget.scss';

interface StatsWidgetProps {
    streak: number;
    totalLifetimeReps: number;
    totalSessionCount: number;
    onOpen: () => void;
}

export function StatsWidget({
    streak,
    totalLifetimeReps,
    totalSessionCount,
    onOpen,
}: StatsWidgetProps) {
    return (
        <button type="button" className="stats-widget" onClick={onOpen}>
            <div className="stats-widget-shine" />

            {/* Streak ring */}
            <div className="stats-widget-ring-wrap">
                <svg className="stats-widget-ring" viewBox="0 0 48 48" width="48" height="48">
                    <circle className="stats-widget-ring-track" cx="24" cy="24" r="20" />
                    <circle
                        className="stats-widget-ring-fill"
                        cx="24" cy="24" r="20"
                        strokeDasharray={`${Math.min(streak / 7, 1) * 125.6} 125.6`}
                    />
                </svg>
                <span className="stats-widget-ring-label">{streak}<span className="stats-widget-ring-fire">🔥</span></span>
            </div>

            {/* Stats columns */}
            <div className="stats-widget-data">
                <div className="stats-widget-row">
                    <div className="stats-widget-stat">
                        <svg className="stats-widget-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
                        </svg>
                        <span className="stats-widget-val">{totalLifetimeReps.toLocaleString()}</span>
                        <span className="stats-widget-lbl">reps</span>
                    </div>
                    <div className="stats-widget-stat">
                        <svg className="stats-widget-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <span className="stats-widget-val">{totalSessionCount}</span>
                        <span className="stats-widget-lbl">sessions</span>
                    </div>
                </div>
            </div>

            {/* CTA badge */}
            <div className="stats-widget-cta">
                <span>📊</span>
                <span>View full stats</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </div>
        </button>
    );
}
