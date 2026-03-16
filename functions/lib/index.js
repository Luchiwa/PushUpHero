"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPushNotification = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-functions/v2/firestore");
admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();
// ─── Helpers ──────────────────────────────────────────────────────────────────
async function getFcmToken(uid) {
    const snap = await db.doc(`users/${uid}`).get();
    return snap.exists ? (snap.data()?.fcmToken ?? null) : null;
}
async function sendPush(token, title, body, type) {
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
exports.sendPushNotification = (0, firestore_1.onDocumentCreated)({ document: 'users/{uid}/notifications/{notifId}', region: 'europe-west1' }, async (event) => {
    const uid = event.params.uid;
    const data = event.data?.data();
    if (!data)
        return;
    const token = await getFcmToken(uid);
    if (!token)
        return; // user hasn't granted push permission yet
    try {
        if (data.type === 'encouragement') {
            await sendPush(token, '💪 Encouragement!', `${data.fromUsername} believes in you — go crush it!`, 'encouragement');
        }
        else if (data.type === 'friend_request') {
            await sendPush(token, '🤝 Friend request', `${data.fromUsername} wants to be your friend!`, 'friend_request');
        }
    }
    catch (err) {
        // Token expired / invalid — clean it up so we don't retry forever
        const isInvalidToken = err instanceof Error &&
            (err.message.includes('registration-token-not-registered') ||
                err.message.includes('invalid-registration-token'));
        if (isInvalidToken) {
            await db.doc(`users/${uid}`).update({ fcmToken: admin.firestore.FieldValue.delete() });
        }
        else {
            console.error('[sendPushNotification] FCM error:', err);
        }
    }
});
//# sourceMappingURL=index.js.map