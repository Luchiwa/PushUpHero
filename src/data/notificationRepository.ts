/**
 * notificationRepository — Firestore read operations for notifications.
 *
 * Encapsulates the unread-notification listener so hooks never see the raw
 * Firestore SDK types. The repo parses each new notification into a domain
 * `NotificationEvent` (timestamps coerced to ms) before invoking the callback.
 */

import { query, where, onSnapshot, limit } from 'firebase/firestore';
import { notificationsCol } from '@infra/refs';
import { parseNotification, type NotificationEvent } from '@infra/firestoreValidators';

export type { NotificationEvent } from '@infra/firestoreValidators';

/**
 * Real-time listener on unread notifications (max 50).
 * Calls `onEvent` for each newly added document, after parsing it into a
 * domain shape with `sentAtMs: number`. Malformed docs are skipped.
 * Returns unsubscribe function.
 */
export function onUnreadNotifications(
    uid: string,
    onEvent: (event: NotificationEvent) => void,
): () => void {
    const q = query(notificationsCol(uid), where('read', '==', false), limit(50));
    return onSnapshot(q, (snap) => {
        for (const change of snap.docChanges()) {
            if (change.type !== 'added') continue;
            const event = parseNotification(change.doc.id, change.doc.data());
            if (event) {
                onEvent(event);
            } else {
                console.warn('[notificationRepository] Invalid notification skipped', change.doc.id);
            }
        }
    });
}
