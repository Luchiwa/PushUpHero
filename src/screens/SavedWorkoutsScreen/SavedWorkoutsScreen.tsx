/**
 * SavedWorkoutsScreen — Lists the user's named workout templates.
 *
 * Auth-only: guests don't reach here (entry point is gated). The realtime
 * listener (`onSavedWorkouts`) is the source of truth; templates appear /
 * reorder / disappear automatically as Firestore changes propagate.
 *
 * PUS-20 commit 1: shell + empty state + listener wiring. Card rendering
 * comes in commit 2; rename/delete actions come in commit 3.
 */
import { useTranslation } from 'react-i18next';
import { PageLayout } from '@components/PageLayout/PageLayout';
import { useSavedWorkouts } from '@hooks/useSavedWorkouts';
import type { UserId } from '@domain';
import type { WorkoutPlan } from '@exercises/types';
import { EmptySavedWorkouts } from './EmptySavedWorkouts/EmptySavedWorkouts';
import './SavedWorkoutsScreen.scss';

interface SavedWorkoutsScreenProps {
    uid: UserId;
    onClose: () => void;
    onPick: (plan: WorkoutPlan, id: string) => void;
}

export function SavedWorkoutsScreen({ uid, onClose, onPick }: SavedWorkoutsScreenProps) {
    const { t } = useTranslation('saved');
    const { workouts, loading } = useSavedWorkouts(uid);

    return (
        <PageLayout title={t('title')} onClose={onClose} zIndex={200} bodyClassName="saved-body">
            {!loading && workouts.length === 0 && (
                <EmptySavedWorkouts onCreate={onClose} />
            )}
            {!loading && workouts.length > 0 && (
                /* TODO(PUS-20 commit 2): swap stub for <SavedWorkoutCard /> grid + chip-row + scroll. */
                <ul className="saved-list-stub">
                    {workouts.map(w => (
                        <li key={w.id}>
                            <button type="button" onClick={() => onPick(w.plan, w.id)}>
                                {w.name}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </PageLayout>
    );
}
