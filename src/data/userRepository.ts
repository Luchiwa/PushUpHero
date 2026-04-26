/**
 * userRepository — Firestore read operations for user profiles.
 *
 * Encapsulates user document listeners so hooks/providers never import
 * firebase/firestore directly.
 */

import { onSnapshot } from 'firebase/firestore';
import { userRef } from '@infra/refs';
import { isDbUser } from '@infra/firestoreValidators';
import type { DbUser } from '@domain/authTypes';

/**
 * Real-time listener on a user profile document.
 * Calls `onData` with a validated DbUser, or `onMissing` if the doc doesn't exist.
 * Malformed docs are skipped with a console.warn — never propagated to the UI.
 * Returns unsubscribe function.
 */
export function onUserProfile(
    uid: string,
    onData: (data: DbUser) => void,
    onMissing?: () => void,
): () => void {
    return onSnapshot(userRef(uid), (snap) => {
        if (!snap.exists()) {
            onMissing?.();
            return;
        }
        const data = snap.data();
        if (!isDbUser(data)) {
            console.warn('[userRepository] Invalid user doc', uid, data);
            return;
        }
        onData(data);
    });
}

/**
 * Real-time listener on a partial user document (for sync hooks that only need
 * a subset, including legacy fields that may be missing from a fully-typed DbUser).
 *
 * Returns the raw data as `Partial<DbUser>` so consumers can probe optional fields
 * without coupling to the Firestore SDK's `DocumentData` type.
 */
export function onUserDoc(
    uid: string,
    onData: (data: Partial<DbUser>) => void,
    onMissing?: () => void,
): () => void {
    return onSnapshot(userRef(uid), (snap) => {
        if (!snap.exists()) {
            onMissing?.();
            return;
        }
        onData(snap.data() as Partial<DbUser>);
    });
}
