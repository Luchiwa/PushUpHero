import { useTranslation } from 'react-i18next';
import './EmptySavedWorkouts.scss';

interface EmptySavedWorkoutsProps {
    onCreate: () => void;
}

export function EmptySavedWorkouts({ onCreate }: EmptySavedWorkoutsProps) {
    const { t } = useTranslation('saved');
    return (
        <div className="saved-empty" role="status" aria-live="polite">
            <span className="saved-empty-icon" aria-hidden="true">📚</span>
            <p className="saved-empty-title">{t('empty.title')}</p>
            <p className="saved-empty-sub">{t('empty.sub')}</p>
            <button type="button" className="saved-empty-cta" onClick={onCreate}>
                {t('create_first')}
            </button>
        </div>
    );
}
