/**
 * MetricToggle — compact segmented pill (XP / Reps).
 * Lives in the StatsScreen topbar `rightAction` slot.
 * Two options only — a dropdown would be overkill.
 */
import type { MetricMode } from '../StatsScreen';
import './MetricToggle.scss';

interface MetricToggleProps {
    metric: MetricMode;
    onChange: (m: MetricMode) => void;
}

export function MetricToggle({ metric, onChange }: MetricToggleProps) {
    return (
        <div className="metric-toggle" role="tablist" aria-label="Chart metric">
            <div
                className="metric-toggle__indicator"
                style={{ left: metric === 'xp' ? '3px' : 'calc(50% + 1px)' }}
            />
            <button
                type="button"
                role="tab"
                aria-selected={metric === 'xp'}
                className={`metric-toggle__btn${metric === 'xp' ? ' active' : ''}`}
                onClick={() => onChange('xp')}
            >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                XP
            </button>
            <button
                type="button"
                role="tab"
                aria-selected={metric === 'reps'}
                className={`metric-toggle__btn${metric === 'reps' ? ' active' : ''}`}
                onClick={() => onChange('reps')}
            >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="1 4 1 10 7 10" />
                    <polyline points="23 20 23 14 17 14" />
                    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
                </svg>
                Reps
            </button>
        </div>
    );
}
