/**
 * SavedWorkoutCard — single template in the saved workouts list.
 *
 * "Fight gym dossier" treatment: an ember blade on the leading edge, a mono
 * kicker tag (`01 · 04 EXERCISES`), an Oswald display title, and a mono
 * stat sheet at the bottom (emojis · sets · last used). Tap-anywhere loads
 * the plan back into the configurator; the kebab opens the actions sheet.
 */
import { useMemo, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate, getTotalSets, type SavedWorkout } from '@domain';
import { getExerciseEmoji, type ExerciseType } from '@exercises/types';
import './SavedWorkoutCard.scss';

interface SavedWorkoutCardProps {
    workout: SavedWorkout;
    /** 1-based position in the list — surfaced in the kicker as a dossier index. */
    index: number;
    onLoad: () => void;
    onActions: (returnFocusEl: HTMLButtonElement) => void;
}

export function SavedWorkoutCard({ workout, index, onLoad, onActions }: SavedWorkoutCardProps) {
    const { t } = useTranslation('saved');

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

    const indexLabel = String(index).padStart(2, '0');

    return (
        <article className="saved-card" style={{ '--i': index - 1 } as CSSProperties}>
            <button type="button" className="saved-card-load" onClick={onLoad}>
                <span className="saved-card-kicker">
                    <span className="saved-card-kicker-tag">{indexLabel}</span>
                    <span className="saved-card-kicker-sep" aria-hidden="true">·</span>
                    <span>{t('exercises_count', { count: uniqueTypes.length })}</span>
                </span>
                <span className="saved-card-name" title={workout.name}>{workout.name}</span>
                <span className="saved-card-meta">
                    <span className="saved-card-emojis" aria-hidden="true">
                        {uniqueTypes.map(type => (
                            <span key={type} className="saved-card-emoji">{getExerciseEmoji(type)}</span>
                        ))}
                    </span>
                    <span className="saved-card-meta-sep" aria-hidden="true" />
                    <span className="saved-card-sets">{t('sets_count', { count: totalSets })}</span>
                    <span className="saved-card-meta-sep" aria-hidden="true" />
                    {workout.lastUsedAt ? (
                        <span className="saved-card-last">{formatDate(workout.lastUsedAt)}</span>
                    ) : (
                        <span className="saved-card-last saved-card-last--never">{t('never_used')}</span>
                    )}
                </span>
            </button>
            <button
                type="button"
                className="saved-card-kebab"
                aria-label={t('actions_label', { name: workout.name })}
                onClick={(e) => onActions(e.currentTarget)}
            >
                <span className="saved-card-kebab-glyph" aria-hidden="true">
                    <span /><span /><span />
                </span>
            </button>
        </article>
    );
}
