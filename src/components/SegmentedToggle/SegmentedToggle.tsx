import type { ReactNode } from 'react';
import './SegmentedToggle.scss';

export interface SegmentedToggleOption<T extends string> {
    value: T;
    label: string;
    icon?: ReactNode;
}

interface SegmentedToggleProps<T extends string> {
    value: T;
    onChange: (value: T) => void;
    options: SegmentedToggleOption<T>[];
    'aria-label'?: string;
}

// ── Generic 2–4 option segmented toggle ────────────────────────
// A pill indicator slides behind the active option. The active
// option's label + icon flip to accent color. The indicator runs
// a periodic shine sweep (via the global mixin) for life.
export function SegmentedToggle<T extends string>({
    value,
    onChange,
    options,
    'aria-label': ariaLabel,
}: SegmentedToggleProps<T>) {
    const activeIdx = Math.max(0, options.findIndex(o => o.value === value));
    const widthPct = 100 / options.length;
    const leftPct = activeIdx * widthPct;

    return (
        <div className="segmented-toggle" role="group" aria-label={ariaLabel}>
            <div
                className="segmented-toggle__indicator"
                style={{ left: `calc(${leftPct}% + 4px)`, width: `calc(${widthPct}% - 8px)` }}
                aria-hidden="true"
            />
            {options.map((opt) => {
                const selected = opt.value === value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        className={`segmented-toggle__btn${selected ? ' is-active' : ''}`}
                        onClick={() => onChange(opt.value)}
                        aria-pressed={selected}
                    >
                        {opt.icon && <span className="segmented-toggle__icon" aria-hidden="true">{opt.icon}</span>}
                        <span className="segmented-toggle__label">{opt.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
