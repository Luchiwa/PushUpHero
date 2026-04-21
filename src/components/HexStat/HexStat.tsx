import type { CSSProperties, ReactNode } from 'react';
import './HexStat.scss';

type Tone = 'ember' | 'gold' | 'ice' | 'purple' | 'blood' | 'good';

interface HexStatProps {
    icon?: ReactNode;
    label: string;
    value: ReactNode;
    tone?: Tone;
}

const TONE_VAR: Record<Tone, string> = {
    ember: 'var(--ember)',
    gold: 'var(--gold)',
    ice: 'var(--ice)',
    purple: 'var(--purple)',
    blood: 'var(--blood)',
    good: 'var(--good)',
};

export function HexStat({ icon, label, value, tone = 'ember' }: HexStatProps) {
    const style = { '--hex-stat-tone': TONE_VAR[tone] } as CSSProperties;
    return (
        <div className="hex-stat" style={style}>
            {icon ? <span className="hex-stat-icon" aria-hidden="true">{icon}</span> : null}
            <div className="hex-stat-text">
                <span className="hex-stat-label">{label}</span>
                <span className="hex-stat-value">{value}</span>
            </div>
        </div>
    );
}
