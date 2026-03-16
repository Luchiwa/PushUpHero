import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getFcmToken(uid: string): Promise<string | null> {
    const snap = await db.doc(`users/${uid}`).get();
    return snap.exists ? (snap.data()?.fcmToken ?? null) : null;
}

async function sendPush(token: string, title: string, body: string, type: string): Promise<void> {
    const link = type === 'friend_request' ? '/#friends' : '/';
    await messaging.send({
        token,
        notification: { title, body },
        data: { type },
        webpush: {
            notification: {
                title,
                body,
                icon: '/pwa-192x192.png',
                badge: '/pwa-192x192.png',
                tag: type,
            },
            fcmOptions: { link },
        },
    });
}

// ─── Trigger: new notification document ───────────────────────────────────────
// Fires whenever a document is added to users/{uid}/notifications/{notifId}
// Reads the FCM token from the user profile and sends a Web Push via FCM.

export const sendPushNotification = onDocumentCreated(
    { document: 'users/{uid}/notifications/{notifId}', region: 'europe-west1' },
    async (event) => {
        const uid = event.params.uid;
        const data = event.data?.data();
        if (!data) return;

        const token = await getFcmToken(uid);
        if (!token) return; // user hasn't granted push permission yet

        try {
            if (data.type === 'encouragement') {
                await sendPush(
                    token,
                    '💪 Encouragement!',
                    `${data.fromUsername} believes in you — go crush it!`,
                    'encouragement',
                );
            } else if (data.type === 'friend_request') {
                await sendPush(
                    token,
                    '🤝 Friend request',
                    `${data.fromUsername} wants to be your friend!`,
                    'friend_request',
                );
            }
        } catch (err: unknown) {
            // Token expired / invalid — clean it up so we don't retry forever
            const isInvalidToken =
                err instanceof Error &&
                (err.message.includes('registration-token-not-registered') ||
                    err.message.includes('invalid-registration-token'));

            if (isInvalidToken) {
                await db.doc(`users/${uid}`).update({ fcmToken: admin.firestore.FieldValue.delete() });
            } else {
                console.error('[sendPushNotification] FCM error:', err);
            }
        }
    },
);
