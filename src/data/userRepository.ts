/**
 * userRepository — Firestore read operations for user profiles.
 *
 * Encapsulates user document listeners so hooks/providers never import
 * firebase/firestore directly.
 */

import { onSnapshot } from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { userRef } from '@infra/refs';
import type { DbUser } from '@domain/authTypes';

/**
 * Real-time listener on a user profile document.
 * Calls `onData` with the raw document data, or `onMissing` if the doc doesn't exist.
 * Returns unsubscribe function.
 */
export function onUserProfile(
    uid: string,
    onData: (data: DbUser) => void,
    onMissing?: () => void,
): () => void {
    return onSnapshot(userRef(uid), (snap) => {
        if (snap.exists()) {
            onData(snap.data() as DbUser);
        } else {
            onMissing?.();
        }
    });
}

/**
 * Real-time listener on raw user document fields (for sync hooks that only need a subset).
 * Calls `onData` with raw DocumentData — caller decides which fields to extract.
 * Returns unsubscribe function.
 */
export function onUserDoc(
    uid: string,
    onData: (data: DocumentData) => void,
    onMissing?: () => void,
): () => void {
    return onSnapshot(userRef(uid), (snap) => {
        if (snap.exists()) {
            onData(snap.data());
        } else {
            onMissing?.();
        }
    });
}
