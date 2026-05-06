import type { ReactNode } from 'react';
import './HubMenuItem.scss';

export type HubIconColor = 'ember' | 'gold' | 'dim' | 'blood';

interface HubMenuItemProps {
    icon: ReactNode;
    iconColor: HubIconColor;
    label: string;
    badge?: number;
    dot?: boolean;
    onClick: () => void;
    ariaLabel?: string;
}

export function HubMenuItem({ icon, iconColor, label, badge, dot, onClick, ariaLabel }: HubMenuItemProps) {
    return (
        <button
            type="button"
            className="hub-item"
            onClick={onClick}
            aria-label={ariaLabel}
        >
            <span className={`hub-item-icon hub-item-icon--${iconColor}`} aria-hidden="true">
                {icon}
            </span>
            <span className="hub-item-label">{label}</span>
            {badge !== undefined && badge > 0 && (
                <span className="hub-item-badge" aria-hidden="true">{badge}</span>
            )}
            {dot && <span className="hub-item-dot" aria-hidden="true" />}
            <svg className="hub-item-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
            </svg>
        </button>
    );
}
