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

// ── Click on notification → focus/open the app ───────────────────
self.addEventListener('notificationclick', (event: NotificationEvent) => {
    event.notification.close();
    event.waitUntil(
        self.clients
            .matchAll({ type: 'window', includeUncontrolled: true })
            .then(clients => {
                const existing = clients.find(c => c.url && 'focus' in c);
                if (existing) return existing.focus();
                return self.clients.openWindow('/');
            })
    );
});
