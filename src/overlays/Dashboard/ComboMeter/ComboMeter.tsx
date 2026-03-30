import { memo } from 'react';
import './ComboMeter.scss';

export interface ComboMeterProps {
    combo: number;
}

export const ComboMeter = memo(function ComboMeter({ combo }: ComboMeterProps) {
    if (combo < 2) return null;
    return (
        <div className="combo-badge" key={combo}>
            <span className="combo-count">{combo}×</span>
            <span className="combo-label">COMBO</span>
        </div>
    );
});
