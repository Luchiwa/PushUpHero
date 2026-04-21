import './XPBar.scss';

interface XPBarProps {
    current: number;
    next: number;
    label?: string;
    rightLabel?: string;
    segments?: number;
}

export function XPBar({ current, next, label, rightLabel, segments = 14 }: XPBarProps) {
    const safeNext = Math.max(1, next);
    const ratio = Math.min(1, Math.max(0, current / safeNext));
    const filled = Math.round(ratio * segments);

    return (
        <div className="xp-bar">
            {(label || rightLabel) && (
                <div className="xp-bar-meta">
                    <span className="xp-bar-label">{label ?? `${current}/${safeNext}`}</span>
                    {rightLabel ? <span className="xp-bar-remaining">{rightLabel}</span> : null}
                </div>
            )}
            <div className="xp-bar-track" role="progressbar" aria-valuemin={0} aria-valuemax={safeNext} aria-valuenow={current}>
                {Array.from({ length: segments }, (_, i) => (
                    <span
                        key={i}
                        className={`xp-bar-seg${i < filled ? ' xp-bar-seg--filled' : ''}`}
                    />
                ))}
            </div>
        </div>
    );
}
