import { useEffect, useCallback, useRef } from 'react';
import {
    collection, query, where, onSnapshot,
    updateDoc, doc,
} from 'firebase/firestore';
import { db } from '@lib/firebase';
import { useAuth } from './useAuth';

export interface AppNotification {
    id: string;
    type: 'encouragement';
    fromUid: string;
    fromUsername: string;
    sentAt: number;
    read: boolean;
}

const ICON = '/pwa-192x192.png';

async function requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
}

function showNativeNotification(title: string, body: string) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    // Try via service worker first (shows even when app is in background)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
            type: 'SHOW_NOTIFICATION',
            title,
            body,
            icon: ICON,
        });
    } else {
        new Notification(title, { body, icon: ICON });
    }
}

export function useNotifications() {
    const { user } = useAuth();
    const permissionRequestedRef = useRef(false);

    // Ask for notification permission once user is logged in
    useEffect(() => {
        if (!user || permissionRequestedRef.current) return;
        permissionRequestedRef.current = true;
        requestPermission();
    }, [user]);

    // Listen to unread notifications in Firestore
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
                        `${data.fromUsername} believes in you — go crush it!`
                    );
                } else if (data.type === 'friend_request') {
                    showNativeNotification(
                        '🤝 Friend request',
                        `${data.fromUsername} wants to be your friend!`
                    );
                }

                // Mark as read so it doesn't fire again on next mount
                await updateDoc(doc(db, 'users', user.uid, 'notifications', change.doc.id), {
                    read: true,
                });
            }
        });

        return () => unsub();
    }, [user]);

    const requestNotificationPermission = useCallback(() => requestPermission(), []);

    return { requestNotificationPermission };
}
