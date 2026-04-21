import type { CSSProperties, ReactNode } from 'react';
import './HexBadge.scss';

type Tone = 'ember' | 'gold' | 'ice' | 'purple' | 'blood' | 'good';

interface HexBadgeProps {
    children: ReactNode;
    size?: number;
    tone?: Tone;
    filled?: boolean;
    className?: string;
}

const TONE_VAR: Record<Tone, string> = {
    ember: 'var(--ember)',
    gold: 'var(--gold)',
    ice: 'var(--ice)',
    purple: 'var(--purple)',
    blood: 'var(--blood)',
    good: 'var(--good)',
};

export function HexBadge({ children, size = 56, tone = 'ember', filled = false, className }: HexBadgeProps) {
    const style = {
        '--hex-size': `${size}px`,
        '--hex-tone': TONE_VAR[tone],
    } as CSSProperties;

    const classes = [
        'hex-badge',
        filled ? 'hex-badge--filled' : 'hex-badge--outline',
        className ?? '',
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <span className={classes} style={style}>
            <span className="hex-badge-content">{children}</span>
        </span>
    );
}
