/**
 * notificationService.ts
 *
 * Notification-related Firestore operations — no React, no hooks.
 */

import { updateDoc, deleteDoc } from 'firebase/firestore';
import { getFcmToken } from '@infra/firebase';
import { userRef, notificationRef } from '@infra/refs';
import type { UserId } from '@domain';

/** Request an FCM token and store it on the user document. */
export async function registerFcmToken(uid: UserId): Promise<void> {
    const token = await getFcmToken();
    if (!token) return;
    await updateDoc(userRef(uid), { fcmToken: token });
}

/** Delete a single notification document. */
export function dismissNotification(uid: UserId, notifId: string): Promise<void> {
    return deleteDoc(notificationRef(uid, notifId));
}
