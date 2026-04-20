import type { CSSProperties, ReactNode } from 'react';
import './CornerFrame.scss';

type Tone = 'ember' | 'gold' | 'ice' | 'purple' | 'good';

interface CornerFrameProps {
    children: ReactNode;
    tone?: Tone;
    size?: number;
    thickness?: number;
    inset?: number;
    className?: string;
}

const TONE_VAR: Record<Tone, string> = {
    ember: 'var(--ember)',
    gold: 'var(--gold)',
    ice: 'var(--ice)',
    purple: 'var(--purple)',
    good: 'var(--good)',
};

export function CornerFrame({
    children,
    tone = 'ember',
    size = 14,
    thickness = 2,
    inset = 0,
    className,
}: CornerFrameProps) {
    const style = {
        '--cf-color': TONE_VAR[tone],
        '--cf-size': `${size}px`,
        '--cf-thickness': `${thickness}px`,
        '--cf-inset': `${inset}px`,
    } as CSSProperties;

    return (
        <div className={`corner-frame${className ? ` ${className}` : ''}`} style={style}>
            <span className="corner-frame-corner corner-frame-corner--tl" aria-hidden="true" />
            <span className="corner-frame-corner corner-frame-corner--tr" aria-hidden="true" />
            <span className="corner-frame-corner corner-frame-corner--bl" aria-hidden="true" />
            <span className="corner-frame-corner corner-frame-corner--br" aria-hidden="true" />
            {children}
        </div>
    );
}
