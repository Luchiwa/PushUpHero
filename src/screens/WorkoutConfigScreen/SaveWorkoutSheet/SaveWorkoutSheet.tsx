/**
 * SaveWorkoutSheet — Bottom-sheet form for naming + persisting a new
 * workout template from `WorkoutConfigScreen`.
 *
 * Mirrors the visual + a11y pattern of `SavedWorkoutActionsSheet`'s
 * rename mode (input + char counter + error wired via `aria-describedby`
 * + ghost/ember CTAs). The visual classes are duplicated rather than
 * shared for now — accept the cost until a third name-form consumer
 * appears, then extract a `WorkoutNameField` primitive.
 *
 * Throws are i18n-keyed (`errors:savedWorkout.invalid_name`) so the catch
 * just hands the message to `t()`.
 */
import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { PageLayout } from '@components/PageLayout/PageLayout';
import { SAVED_WORKOUT_NAME_MAX, validateSavedWorkoutName, type UserId } from '@domain';
import { createSavedWorkout } from '@services/savedWorkoutService';
import type { WorkoutPlan } from '@exercises/types';
import './SaveWorkoutSheet.scss';

interface SaveWorkoutSheetProps {
    uid: UserId;
    plan: WorkoutPlan;
    onClose: () => void;
    onSaved: (name: string) => void;
}

export function SaveWorkoutSheet({ uid, plan, onClose, onSaved }: SaveWorkoutSheetProps) {
    const { t } = useTranslation('workout');
    const [value, setValue] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const inputId = useId();
    const errorId = useId();

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        try {
            const trimmed = validateSavedWorkoutName(value);
            setError(null);
            setBusy(true);
            await createSavedWorkout(uid, plan, trimmed);
            onSaved(trimmed);
        } catch (err) {
            setError(t((err as Error).message));
            setBusy(false);
        }
    }

    return (
        <PageLayout
            title={t('config.save.title')}
            onClose={onClose}
            zIndex={210}
            transition="sheet"
            bodyClassName="save-sheet-body"
        >
            <form className="save-sheet" onSubmit={handleSubmit} noValidate>
                <label className="save-sheet-label" htmlFor={inputId}>{t('config.save.label')}</label>
                <div className="save-sheet-field">
                    <input
                        id={inputId}
                        type="text"
                        className={`save-sheet-input${error ? ' save-sheet-input--error' : ''}`}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder={t('config.save.placeholder')}
                        maxLength={SAVED_WORKOUT_NAME_MAX}
                        aria-describedby={error ? errorId : undefined}
                        aria-invalid={error ? 'true' : undefined}
                        autoFocus
                        disabled={busy}
                    />
                    <span className="save-sheet-counter" aria-hidden="true">
                        {value.length}/{SAVED_WORKOUT_NAME_MAX}
                    </span>
                </div>
                {error && <span id={errorId} role="alert" className="save-sheet-error">{error}</span>}
                <div className="save-sheet-cta-row">
                    <button type="button" className="save-sheet-cta save-sheet-cta--ghost" onClick={onClose} disabled={busy}>
                        {t('config.save.cancel')}
                    </button>
                    <button type="submit" className="save-sheet-cta save-sheet-cta--ember" disabled={busy || value.trim().length === 0}>
                        {t('config.save.submit')}
                    </button>
                </div>
            </form>
        </PageLayout>
    );
}
