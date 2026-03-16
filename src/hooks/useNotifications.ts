import { useEffect, useCallback, useRef } from 'react';
import {
    collection, query, where, onSnapshot,
    updateDoc, doc,
} from 'firebase/firestore';
import { db, getFcmToken } from '@lib/firebase';
import { useAuth } from './useAuth';

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

// ─── In-app notification fallback (when app is open) ─────────────────────────
// When the app is open, the SW push may not show (browser suppresses it).
// We use the Firestore onSnapshot to show a native notification directly,
// and mark it as read so the Cloud Function doesn't retry.

const ICON = '/pwa-192x192.png';

function showNativeNotification(title: string, body: string) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    new Notification(title, { body, icon: ICON });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNotifications() {
    const { user } = useAuth();
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

    // 2. While app is open: listen for unread notifications → show in-app + mark read
    //    (The Cloud Function handles background push via FCM — this is the foreground fallback)
    useEffect(() => {
        if (!user) return;

        const notifRef = collection(db, 'users', user.uid, 'notifications');
        const unreadQuery = query(notifRef, where('read', '==', false));

        const unsub = onSnapshot(unreadQuery, async snap => {
            for (const change of snap.docChanges()) {
                if (change.type !== 'added') continue;

                const data = change.doc.data() as Omit<AppNotification, 'id'>;

                if (data.type === 'encouragement') {
                    showNativeNotification(
                        '💪 Encouragement!',
                        `${data.fromUsername} believes in you — go crush it!`,
                    );
                } else if (data.type === 'friend_request') {
                    showNativeNotification(
                        '🤝 Friend request',
                        `${data.fromUsername} wants to be your friend!`,
                    );
                }

                await updateDoc(
                    doc(db, 'users', user.uid, 'notifications', change.doc.id),
                    { read: true },
                );
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
