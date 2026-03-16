/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
precacheAndRoute((self as any).__WB_MANIFEST);

// ── Handle messages from the app ──────────────────────────────────
self.addEventListener('message', (event: ExtendableMessageEvent) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
        return;
    }

    if (event.data?.type === 'SHOW_NOTIFICATION') {
        const { title, body, icon } = event.data as {
            type: string;
            title: string;
            body: string;
            icon: string;
        };

        event.waitUntil(
            self.registration.showNotification(title, {
                body,
                icon,
                badge: icon,
                tag: 'encouragement',
                renotify: true,
            } as NotificationOptions)
        );
    }
});

// ── FCM background push notifications ───────────────────────────
self.addEventListener('push', (event: PushEvent) => {
    const data = event.data?.json() as {
        notification?: { title?: string; body?: string };
        data?: { type?: string };
    } | undefined;

    const title = data?.notification?.title ?? 'PushUp Hero';
    const body  = data?.notification?.body  ?? '';

    event.waitUntil(
        self.registration.showNotification(title, {
            body,
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            tag: data?.data?.type ?? 'notification',
            renotify: true,
        } as NotificationOptions)
    );
});

// ── Click on notification → focus/open the app ───────────────────
self.addEventListener('notificationclick', (event: NotificationEvent) => {
    event.notification.close();

    const tag = event.notification.tag;
    const targetUrl = tag === 'friend_request' ? '/#friends' : '/';

    event.waitUntil(
        self.clients
            .matchAll({ type: 'window', includeUncontrolled: true })
            .then(clients => {
                // If app already open, navigate it to the right URL and focus
                const existing = clients.find(c => 'navigate' in c);
                if (existing) {
                    (existing as WindowClient).navigate(targetUrl);
                    return existing.focus();
                }
                return self.clients.openWindow(targetUrl);
            })
    );
});
