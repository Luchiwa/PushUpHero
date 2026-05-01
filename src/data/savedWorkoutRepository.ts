/**
 * savedWorkoutRepository — Firestore read operations for saved workout templates.
 *
 * Sub-collection: `users/{uid}/savedWorkouts/{id}`. The listener and one-shot
 * both validate each doc through `parseSavedWorkout` before emitting; malformed
 * docs are filtered with `console.warn` rather than propagated to the UI.
 */

import { onSnapshot, getDocs } from 'firebase/firestore';
import { savedWorkoutsCol } from '@infra/refs';
import { parseSavedWorkout } from '@infra/firestoreValidators';
import type { SavedWorkout, UserId } from '@domain';

/**
 * Sort by recency: `lastUsedAt` descending, with `createdAt` as fallback for
 * never-used templates. Domain-side sort — no Firestore index required.
 */
function recencyDesc(a: SavedWorkout, b: SavedWorkout): number {
    return (b.lastUsedAt ?? b.createdAt) - (a.lastUsedAt ?? a.createdAt);
}

/** Real-time listener on the user's saved workouts. Returns unsubscribe. */
export function onSavedWorkouts(
    uid: UserId,
    callback: (workouts: SavedWorkout[]) => void,
): () => void {
    return onSnapshot(savedWorkoutsCol(uid), snap => {
        const workouts: SavedWorkout[] = [];
        for (const d of snap.docs) {
            const parsed = parseSavedWorkout(d.id, d.data());
            if (parsed) workouts.push(parsed);
            else console.warn('[savedWorkoutRepository] Invalid saved workout skipped', d.id);
        }
        workouts.sort(recencyDesc);
        callback(workouts);
    });
}

/** One-shot fetch of the user's saved workouts. */
export async function getSavedWorkouts(uid: UserId): Promise<SavedWorkout[]> {
    const snap = await getDocs(savedWorkoutsCol(uid));
    const workouts: SavedWorkout[] = [];
    for (const d of snap.docs) {
        const parsed = parseSavedWorkout(d.id, d.data());
        if (parsed) workouts.push(parsed);
        else console.warn('[savedWorkoutRepository] Invalid saved workout skipped', d.id);
    }
    workouts.sort(recencyDesc);
    return workouts;
}
