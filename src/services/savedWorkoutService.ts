/**
 * savedWorkoutService — Firestore write operations for saved workout templates.
 *
 * Auth-only: each function asserts `uid` and throws `errors:savedWorkout.auth_required`
 * when called without one. Guests don't sync (decided in PUS-19); the future UI
 * gating belongs in PUS-20.
 *
 * Errors are thrown with i18n keys in the message — callers consume via
 * `t((err as Error).message)`. Same pattern as `translateAuthError`'s `errors:`-
 * prefixed throws (no dedicated wrapper needed because the keys are already
 * canonical at the source).
 */

import { addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { savedWorkoutsCol, savedWorkoutRef } from '@infra/refs';
import { validateSavedWorkoutName, type SavedWorkout, type UserId } from '@domain';
import type { WorkoutPlan } from '@exercises/types';

function assertAuth(uid: UserId | undefined | null): asserts uid is UserId {
    if (!uid) throw new Error('errors:savedWorkout.auth_required');
}

/** Persist a new saved workout. Returns the full domain shape with the generated id. */
export async function createSavedWorkout(
    uid: UserId,
    plan: WorkoutPlan,
    rawName: string,
): Promise<SavedWorkout> {
    assertAuth(uid);
    const name = validateSavedWorkoutName(rawName);
    const now = Date.now();
    const docRef = await addDoc(savedWorkoutsCol(uid), {
        name,
        plan,
        createdAt: now,
        lastUsedAt: null,
        version: 1,
    });
    return { id: docRef.id, name, plan, createdAt: now, lastUsedAt: null, version: 1 };
}

/** Rename an existing saved workout. */
export async function renameSavedWorkout(
    uid: UserId,
    id: string,
    rawName: string,
): Promise<void> {
    assertAuth(uid);
    const name = validateSavedWorkoutName(rawName);
    await updateDoc(savedWorkoutRef(uid, id), { name });
}

/** Delete a saved workout. */
export async function deleteSavedWorkout(uid: UserId, id: string): Promise<void> {
    assertAuth(uid);
    await deleteDoc(savedWorkoutRef(uid, id));
}

/** Bump `lastUsedAt` to now — call when the user launches this template. */
export async function touchSavedWorkout(uid: UserId, id: string): Promise<void> {
    assertAuth(uid);
    await updateDoc(savedWorkoutRef(uid, id), { lastUsedAt: Date.now() });
}
