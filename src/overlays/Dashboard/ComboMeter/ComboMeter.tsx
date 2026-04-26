import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import './ComboMeter.scss';

export interface ComboMeterProps {
    combo: number;
}

export const ComboMeter = memo(function ComboMeter({ combo }: ComboMeterProps) {
    const { t } = useTranslation('dashboard');
    if (combo < 2) return null;
    return (
        <div className="combo-badge" key={combo}>
            <span className="combo-count">{combo}×</span>
            <span className="combo-label">{t('combo_label')}</span>
        </div>
    );
});
