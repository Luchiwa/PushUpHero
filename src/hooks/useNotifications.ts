import { useEffect, useCallback, useRef } from 'react';
import {
    collection, query, where, onSnapshot,
    deleteDoc, doc, updateDoc,
} from 'firebase/firestore';
import { db, getFcmToken } from '@lib/firebase';
import { useAuthCore } from './useAuth';

export interface AppNotification {
    id: string;
    type: 'encouragement' | 'friend_request';
    fromUid: string;
    fromUsername: string;
    sentAt: number;
    read: boolean;
}

// ─── Register FCM token in Firestore ─────────────────────────────────────────

async function registerFcmToken(uid: string): Promise<void> {
    const token = await getFcmToken();
    if (!token) return;
    await updateDoc(doc(db, 'users', uid), { fcmToken: token });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNotifications() {
    const { user } = useAuthCore();
    const tokenRegisteredRef = useRef(false);

    // 1. Request permission + register FCM token once user logs in
    useEffect(() => {
        if (!user || tokenRegisteredRef.current) return;

        const setup = async () => {
            if (!('Notification' in window)) return;

            if (Notification.permission === 'default') {
                await Notification.requestPermission();
            }

            if (Notification.permission !== 'granted') return;

            tokenRegisteredRef.current = true;
            await registerFcmToken(user.uid);
        };

        setup();
    }, [user]);

    // 2. While app is open: listen for unread notifications and delete them.
    //    Push display is handled exclusively by FCM → Service Worker.
    //    This listener only cleans up the Firestore document so it doesn't
    //    pile up. We skip docs older than 30s to avoid mass-deleting on
    //    initial snapshot load (those will be purged by the daily Cloud Function).
    useEffect(() => {
        if (!user) return;

        const notifRef = collection(db, 'users', user.uid, 'notifications');
        const unreadQuery = query(notifRef, where('read', '==', false));

        const unsub = onSnapshot(unreadQuery, async snap => {
            for (const change of snap.docChanges()) {
                if (change.type !== 'added') continue;

                const data = change.doc.data();
                const sentAt = data.sentAt?.toMillis?.() ?? data.sentAt ?? 0;
                const age = Date.now() - sentAt;

                // Only auto-delete fresh notifications (< 30s)
                // Older ones are left for the daily server-side purge
                if (age < 30_000) {
                    await deleteDoc(
                        doc(db, 'users', user.uid, 'notifications', change.doc.id),
                    );
                }
            }
        });

        return () => unsub();
    }, [user]);

    const requestNotificationPermission = useCallback(async () => {
        if (!('Notification' in window)) return;
        if (Notification.permission !== 'default') return;
        const result = await Notification.requestPermission();
        if (result === 'granted' && user) {
            tokenRegisteredRef.current = true;
            await registerFcmToken(user.uid);
        }
    }, [user]);

    return { requestNotificationPermission };
}
