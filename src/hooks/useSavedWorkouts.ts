/**
 * useSavedWorkouts — realtime listener over the user's saved workout templates.
 *
 * Returns the validated, recency-sorted list (sort applied repo-side in
 * `onSavedWorkouts`). Guests pass `null` and get an empty list — saved workouts
 * are auth-only by design (PUS-19).
 */
import { useEffect, useState } from 'react';
import { onSavedWorkouts } from '@data/savedWorkoutRepository';
import type { SavedWorkout, UserId } from '@domain';

export function useSavedWorkouts(uid: UserId | null | undefined) {
    const [workouts, setWorkouts] = useState<SavedWorkout[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!uid) {
            // Defer the reset so we don't trigger a cascading render in the
            // same tick as the effect body — same dance as `useFriends`.
            setTimeout(() => {
                setWorkouts([]);
                setLoading(false);
            }, 0);
            return;
        }
        const unsubscribe = onSavedWorkouts(uid, list => {
            setWorkouts(list);
            setLoading(false);
        });
        return () => { unsubscribe(); };
    }, [uid]);

    return { workouts, loading };
}
