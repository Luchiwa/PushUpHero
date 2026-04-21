import type { ReactNode } from 'react';
import './ScreenHeader.scss';

interface ScreenHeaderProps {
    kicker?: string;
    title: string;
    onBack?: () => void;
    rightSlot?: ReactNode;
    align?: 'center' | 'left';
}

export function ScreenHeader({ kicker, title, onBack, rightSlot, align = 'center' }: ScreenHeaderProps) {
    return (
        <header className={`screen-header screen-header--${align}`}>
            {onBack ? (
                <button type="button" className="screen-header-back" onClick={onBack} aria-label="Back">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>
            ) : (
                <span className="screen-header-slot" aria-hidden="true" />
            )}

            <div className="screen-header-text">
                {kicker ? <span className="screen-header-kicker">{kicker}</span> : null}
                <h1 className="screen-header-title">{title}</h1>
            </div>

            <span className="screen-header-slot">{rightSlot}</span>
        </header>
    );
}
