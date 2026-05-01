/**
 * SavedWorkoutActionsSheet — Bottom-sheet host for rename / delete on a
 * single saved workout. Three internal modes (`menu` / `rename` / `delete`)
 * swap content while the surrounding sheet stays mounted; the back arrow
 * (via PageLayout's `onBack`) rewinds to `menu` without animating the
 * sheet out, so the user only escapes the whole sheet from menu mode.
 *
 * The delete confirm extracts to its own component so `useFocusTrap`'s
 * effect fires when the dialog mounts (the trap container ref is only
 * populated then).
 */
import { useId, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { PageLayout } from '@components/PageLayout/PageLayout';
import { useFocusTrap } from '@hooks/shared/useFocusTrap';
import {
    SAVED_WORKOUT_NAME_MAX,
    validateSavedWorkoutName,
    type SavedWorkout,
    type UserId,
} from '@domain';
import { deleteSavedWorkout, renameSavedWorkout } from '@services/savedWorkoutService';
import './SavedWorkoutActionsSheet.scss';

type Mode = 'menu' | 'rename' | 'delete';

interface SavedWorkoutActionsSheetProps {
    workout: SavedWorkout;
    uid: UserId;
    onClose: () => void;
    onRenamed: () => void;
    onDeleted: (name: string) => void;
}

const HEADER_KEY: Record<Mode, string> = {
    menu: 'actions.title',
    rename: 'rename.title',
    delete: 'delete.title',
};

export function SavedWorkoutActionsSheet({
    workout, uid, onClose, onRenamed, onDeleted,
}: SavedWorkoutActionsSheetProps) {
    const { t } = useTranslation('saved');
    const [mode, setMode] = useState<Mode>('menu');

    return (
        <PageLayout
            title={t(HEADER_KEY[mode])}
            onClose={onClose}
            onBack={mode === 'menu' ? undefined : () => setMode('menu')}
            zIndex={210}
            transition="sheet"
            bodyClassName="actions-sheet-body"
        >
            <div className="actions-sheet">
                {mode === 'menu' && (
                    <Menu t={t} onRename={() => setMode('rename')} onDelete={() => setMode('delete')} />
                )}
                {mode === 'rename' && (
                    <RenameForm
                        workout={workout} uid={uid} t={t}
                        onCancel={() => setMode('menu')}
                        onDone={() => { onRenamed(); onClose(); }}
                    />
                )}
                {mode === 'delete' && (
                    <DeleteConfirm
                        workout={workout} uid={uid} t={t}
                        onCancel={() => setMode('menu')}
                        onDone={() => { onDeleted(workout.name); onClose(); }}
                    />
                )}
            </div>
        </PageLayout>
    );
}

function Menu({ t, onRename, onDelete }: { t: TFunction<'saved'>; onRename: () => void; onDelete: () => void }) {
    return (
        <ul className="actions-sheet-menu" role="list">
            <li>
                <button type="button" className="actions-row" onClick={onRename}>
                    <PencilIcon />
                    <span className="actions-row-name">{t('actions.rename')}</span>
                    <ChevronIcon />
                </button>
            </li>
            <li>
                <button type="button" className="actions-row actions-row--danger" onClick={onDelete}>
                    <TrashIcon />
                    <span className="actions-row-name">{t('actions.delete')}</span>
                    <ChevronIcon />
                </button>
            </li>
        </ul>
    );
}

function RenameForm({ workout, uid, t, onCancel, onDone }: {
    workout: SavedWorkout; uid: UserId; t: TFunction<'saved'>;
    onCancel: () => void; onDone: () => void;
}) {
    const [value, setValue] = useState(workout.name);
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
            await renameSavedWorkout(uid, workout.id, trimmed);
            onDone();
        } catch (err) {
            setError(t((err as Error).message));
            setBusy(false);
        }
    }

    return (
        <form className="actions-sheet-rename" onSubmit={handleSubmit} noValidate>
            <label className="actions-rename-label" htmlFor={inputId}>{t('rename.label')}</label>
            <div className="actions-rename-field">
                <input
                    id={inputId}
                    type="text"
                    className={`actions-rename-input${error ? ' actions-rename-input--error' : ''}`}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={t('rename.placeholder')}
                    maxLength={SAVED_WORKOUT_NAME_MAX}
                    aria-describedby={error ? errorId : undefined}
                    aria-invalid={error ? 'true' : undefined}
                    autoFocus
                    disabled={busy}
                />
                <span className="actions-rename-counter" aria-hidden="true">
                    {value.length}/{SAVED_WORKOUT_NAME_MAX}
                </span>
            </div>
            {error && <span id={errorId} role="alert" className="actions-rename-error">{error}</span>}
            <div className="actions-sheet-cta-row">
                <button type="button" className="actions-cta actions-cta--ghost" onClick={onCancel} disabled={busy}>{t('rename.cancel')}</button>
                <button type="submit" className="actions-cta actions-cta--ember" disabled={busy}>{t('rename.submit')}</button>
            </div>
        </form>
    );
}

function DeleteConfirm({ workout, uid, t, onCancel, onDone }: {
    workout: SavedWorkout; uid: UserId; t: TFunction<'saved'>;
    onCancel: () => void; onDone: () => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    useFocusTrap(ref);
    const [busy, setBusy] = useState(false);

    async function handleConfirm() {
        try {
            setBusy(true);
            await deleteSavedWorkout(uid, workout.id);
            onDone();
        } catch {
            setBusy(false);
        }
    }

    return (
        <div ref={ref} className="actions-sheet-delete" role="alertdialog" aria-modal="true">
            <p className="actions-delete-body">{t('delete.body', { name: workout.name })}</p>
            <div className="actions-sheet-cta-row">
                <button type="button" className="actions-cta actions-cta--ghost" onClick={onCancel} disabled={busy}>{t('delete.cancel')}</button>
                <button type="button" className="actions-cta actions-cta--blood" onClick={handleConfirm} disabled={busy}>{t('delete.confirm')}</button>
            </div>
        </div>
    );
}

// ── Icons (inline SVG, currentColor) ───────────────────────────
function PencilIcon() {
    return (<svg className="actions-row-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>);
}
function TrashIcon() {
    return (<svg className="actions-row-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>);
}
function ChevronIcon() {
    return (<svg className="actions-row-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>);
}
