/**
 * SavedWorkoutCard — Single template in the saved workouts list.
 *
 * Two side-by-side buttons inside an `<article>`:
 *   1. The full-width "load" button — tap loads the plan back into config.
 *   2. The kebab "actions" button — opens the rename/delete sheet (PUS-20 commit 3).
 *      Wired non-functionally for now so the visual + a11y land in commit 2 alongside
 *      the rest of the card; the click handler is filled in commit 3.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate, getTotalSets, type SavedWorkout } from '@domain';
import { getExerciseEmoji, type ExerciseType } from '@exercises/types';
import './SavedWorkoutCard.scss';

interface SavedWorkoutCardProps {
    workout: SavedWorkout;
    onLoad: () => void;
    onActions: (returnFocusEl: HTMLButtonElement) => void;
}

export function SavedWorkoutCard({ workout, onLoad, onActions }: SavedWorkoutCardProps) {
    const { t } = useTranslation('saved');

    // Unique exercise types in the order they appear in the plan.
    const uniqueTypes = useMemo<ExerciseType[]>(() => {
        const seen = new Set<ExerciseType>();
        const out: ExerciseType[] = [];
        for (const block of workout.plan.blocks) {
            if (!seen.has(block.exerciseType)) {
                seen.add(block.exerciseType);
                out.push(block.exerciseType);
            }
        }
        return out;
    }, [workout.plan.blocks]);

    const totalSets = useMemo(() => getTotalSets(workout.plan), [workout.plan]);

    const lastUsedLabel = workout.lastUsedAt
        ? t('last_used', { date: formatDate(workout.lastUsedAt) })
        : t('never_used');

    return (
        <article className="saved-card">
            <button
                type="button"
                className="saved-card-load"
                onClick={onLoad}
            >
                <span className="saved-card-name" title={workout.name}>{workout.name}</span>
                <span className="saved-card-meta">
                    <span className="saved-card-emojis" aria-hidden="true">
                        {uniqueTypes.map(type => (
                            <span key={type} className="saved-card-emoji">{getExerciseEmoji(type)}</span>
                        ))}
                    </span>
                    <span className="saved-card-dot" aria-hidden="true">·</span>
                    <span className="saved-card-sets">{t('sets_count', { count: totalSets })}</span>
                </span>
                <span className="saved-card-last-used">{lastUsedLabel}</span>
            </button>
            <button
                type="button"
                className="saved-card-kebab"
                aria-label={t('actions_label', { name: workout.name })}
                onClick={(e) => onActions(e.currentTarget)}
            >
                <span aria-hidden="true">⋯</span>
            </button>
        </article>
    );
}
