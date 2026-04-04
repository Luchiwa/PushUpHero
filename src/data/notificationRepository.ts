/**
 * notificationRepository — Firestore read operations for notifications.
 *
 * Encapsulates the unread-notification listener so hooks never import
 * firebase/firestore directly.
 */

import { query, where, onSnapshot, limit } from 'firebase/firestore';
import type { DocumentChange, DocumentData } from 'firebase/firestore';
import { notificationsCol } from '@infra/refs';

/**
 * Real-time listener on unread notifications (max 50).
 * Calls `onChange` with each newly added document change.
 * Returns unsubscribe function.
 */
export function onUnreadNotifications(
    uid: string,
    onChange: (change: DocumentChange<DocumentData>) => void,
): () => void {
    const q = query(notificationsCol(uid), where('read', '==', false), limit(50));
    return onSnapshot(q, (snap) => {
        for (const change of snap.docChanges()) {
            if (change.type === 'added') {
                onChange(change);
            }
        }
    });
}
