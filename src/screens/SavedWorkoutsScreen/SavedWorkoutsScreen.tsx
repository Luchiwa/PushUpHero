/**
 * SavedWorkoutsScreen — Lists the user's named workout templates.
 *
 * Auth-only: guests don't reach here (entry point is gated). The realtime
 * listener (`onSavedWorkouts`) is the source of truth; templates appear /
 * reorder / disappear automatically as Firestore changes propagate.
 *
 * PUS-20 commit 2: card rendering + tap-to-load. Rename/delete actions
 * (kebab → bottom-sheet) come in commit 3.
 */
import { useTranslation } from 'react-i18next';
import { PageLayout } from '@components/PageLayout/PageLayout';
import { useSavedWorkouts } from '@hooks/useSavedWorkouts';
import { touchSavedWorkout } from '@services/savedWorkoutService';
import type { SavedWorkout, UserId } from '@domain';
import type { WorkoutPlan } from '@exercises/types';
import { EmptySavedWorkouts } from './EmptySavedWorkouts/EmptySavedWorkouts';
import { SavedWorkoutCard } from './SavedWorkoutCard/SavedWorkoutCard';
import './SavedWorkoutsScreen.scss';

interface SavedWorkoutsScreenProps {
    uid: UserId;
    onClose: () => void;
    onPick: (plan: WorkoutPlan, id: string) => void;
}

export function SavedWorkoutsScreen({ uid, onClose, onPick }: SavedWorkoutsScreenProps) {
    const { t } = useTranslation('saved');
    const { workouts, loading } = useSavedWorkouts(uid);

    const handleLoad = (workout: SavedWorkout) => {
        // Fire-and-forget: the lastUsedAt bump should not block returning to config.
        // Errors here aren't user-facing — the listener will eventually reflect the
        // updated value, and a missed bump only affects sort ordering.
        touchSavedWorkout(uid, workout.id).catch(err => {
            console.warn('[SavedWorkoutsScreen] touchSavedWorkout failed', err);
        });
        onPick(workout.plan, workout.id);
    };

    return (
        <PageLayout title={t('title')} onClose={onClose} zIndex={200} bodyClassName="saved-body">
            {!loading && workouts.length === 0 && (
                <EmptySavedWorkouts onCreate={onClose} />
            )}
            {!loading && workouts.length > 0 && (
                <div className="saved-list">
                    {workouts.map(w => (
                        <SavedWorkoutCard
                            key={w.id}
                            workout={w}
                            onLoad={() => handleLoad(w)}
                        />
                    ))}
                </div>
            )}
        </PageLayout>
    );
}
