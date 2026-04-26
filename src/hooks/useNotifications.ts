import { useEffect, useCallback, useRef } from 'react';
import { onUnreadNotifications } from '@data/notificationRepository';
import { registerFcmToken, dismissNotification } from '@services/notificationService';
import { useAuthCore } from './useAuth';

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
    useEffect(() => {
        if (!user) return;

        const unsub = onUnreadNotifications(user.uid, (event) => {
            const age = Date.now() - event.sentAtMs;

            // Only auto-delete fresh notifications (< 30s)
            if (age < 30_000) {
                dismissNotification(user.uid, event.id).catch(err =>
                    console.error('[useNotifications] dismiss failed', err));
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
