import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import './WeekNavigator.scss';

interface WeekNavigatorProps {
    currentWeekOffset: number;
    onPrev: () => void;
    onNext: () => void;
    weekLabel: string;
    isPrevDisabled: boolean;
    isNextDisabled: boolean;
}

/** Tiny relative-week chip: THIS WEEK / LAST WEEK / N WEEKS AGO. */
function relativeChip(offset: number, t: TFunction<'stats'>): string {
    if (offset === 0) return t('screen.week_chip_this');
    if (offset === -1) return t('screen.week_chip_last');
    if (offset < -1) return t('screen.week_chip_n_ago', { count: Math.abs(offset) });
    return t('screen.week_chip_upcoming');
}

export function WeekNavigator({ currentWeekOffset, onPrev, onNext, weekLabel, isPrevDisabled, isNextDisabled }: WeekNavigatorProps) {
    const { t } = useTranslation('stats');
    const chip = relativeChip(currentWeekOffset, t);
    const isCurrent = currentWeekOffset === 0;

    return (
        <div className="stats-week-nav">
            <button
                type="button"
                className="stats-nav-btn"
                onClick={onPrev}
                disabled={isPrevDisabled}
                aria-label={t('screen.week_prev_aria')}
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            </button>

            <div className="stats-week-center">
                <span className={`stats-week-chip${isCurrent ? ' stats-week-chip--current' : ''}`}>{chip}</span>
                <span className="stats-week-label">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                    {weekLabel}
                </span>
            </div>

            <button
                type="button"
                className="stats-nav-btn"
                onClick={onNext}
                disabled={isNextDisabled}
                aria-label={t('screen.week_next_aria')}
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
        </div>
    );
}
