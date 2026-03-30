import './WeekNavigator.scss';

interface WeekNavigatorProps {
    currentWeekOffset: number;
    onPrev: () => void;
    onNext: () => void;
    weekLabel: string;
    isPrevDisabled: boolean;
    isNextDisabled: boolean;
}

export function WeekNavigator({ onPrev, onNext, weekLabel, isPrevDisabled, isNextDisabled }: WeekNavigatorProps) {
    return (
        <div className="stats-week-nav">
            <button
                type="button"
                className="stats-nav-btn"
                onClick={onPrev}
                disabled={isPrevDisabled}
                aria-label="Previous week"
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <span className="stats-week-label">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                {weekLabel}
            </span>
            <button
                type="button"
                className="stats-nav-btn"
                onClick={onNext}
                disabled={isNextDisabled}
                aria-label="Next week"
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
        </div>
    );
}
