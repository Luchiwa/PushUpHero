/**
 * SavedWorkoutsScreen — Lists the user's named workout templates.
 *
 * Auth-only: guests don't reach here (entry point is gated). The realtime
 * listener (`onSavedWorkouts`) is the source of truth; templates appear /
 * reorder / disappear automatically as Firestore changes propagate.
 *
 * Tap a card to load its plan back into config (`onPick`). The kebab opens
 * a bottom-sheet for rename / delete; we hold the originating button in
 * `activeActions` so focus restores there when the sheet closes.
 */
import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageLayout } from '@components/PageLayout/PageLayout';
import { ModalFallback } from '@components/ModalFallback/ModalFallback';
import { useSavedWorkouts } from '@hooks/useSavedWorkouts';
import { touchSavedWorkout } from '@services/savedWorkoutService';
import type { SavedWorkout, UserId } from '@domain';
import type { WorkoutPlan } from '@exercises/types';
import { EmptySavedWorkouts } from './EmptySavedWorkouts/EmptySavedWorkouts';
import { SavedWorkoutCard } from './SavedWorkoutCard/SavedWorkoutCard';
import './SavedWorkoutsScreen.scss';

const SavedWorkoutActionsSheet = lazy(() =>
    import('./SavedWorkoutActionsSheet/SavedWorkoutActionsSheet').then(m => ({ default: m.SavedWorkoutActionsSheet })),
);

interface SavedWorkoutsScreenProps {
    uid: UserId;
    onClose: () => void;
    onPick: (plan: WorkoutPlan, id: string) => void;
}

interface ActiveActions {
    workout: SavedWorkout;
    returnFocusEl: HTMLButtonElement;
}

export function SavedWorkoutsScreen({ uid, onClose, onPick }: SavedWorkoutsScreenProps) {
    const { t } = useTranslation('saved');
    const { workouts, loading } = useSavedWorkouts(uid);
    const [activeActions, setActiveActions] = useState<ActiveActions | null>(null);
    const [liveMessage, setLiveMessage] = useState('');

    const handleLoad = (workout: SavedWorkout) => {
        // Fire-and-forget: the lastUsedAt bump should not block returning to
        // config. A missed bump only affects future sort ordering.
        touchSavedWorkout(uid, workout.id).catch(err => {
            console.warn('[SavedWorkoutsScreen] touchSavedWorkout failed', err);
        });
        onPick(workout.plan, workout.id);
    };

    const closeActions = () => {
        const returnEl = activeActions?.returnFocusEl;
        setActiveActions(null);
        // Defer to next tick so the sheet's exit animation doesn't fight the focus.
        setTimeout(() => returnEl?.focus(), 0);
    };

    const announceDeleted = (name: string) => {
        // Toggle through empty so screen readers re-announce identical names.
        setLiveMessage('');
        setTimeout(() => setLiveMessage(t('deleted', { name })), 50);
    };

    return (
        <>
            <PageLayout title={t('title')} onClose={onClose} zIndex={200} bodyClassName="saved-body">
                {!loading && workouts.length === 0 && (
                    <EmptySavedWorkouts onCreate={onClose} />
                )}
                {!loading && workouts.length > 0 && (
                    <div className="saved-list">
                        {workouts.map((w, i) => (
                            <SavedWorkoutCard
                                key={w.id}
                                workout={w}
                                index={i + 1}
                                onLoad={() => handleLoad(w)}
                                onActions={(el) => setActiveActions({ workout: w, returnFocusEl: el })}
                            />
                        ))}
                    </div>
                )}
                <div role="status" aria-live="polite" className="saved-live">{liveMessage}</div>
            </PageLayout>
            <Suspense fallback={<ModalFallback />}>
                {activeActions && (
                    <SavedWorkoutActionsSheet
                        workout={activeActions.workout}
                        uid={uid}
                        onClose={closeActions}
                        onRenamed={() => { /* listener will re-emit the renamed workout */ }}
                        onDeleted={(name) => announceDeleted(name)}
                    />
                )}
            </Suspense>
        </>
    );
}
