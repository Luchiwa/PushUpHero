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
exports.sendStreakReminders = exports.resetExpiredStreaks = exports.sendPushNotification = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
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
// ─── Helpers: date strings (Europe/Paris) ─────────────────────────────────────
// The client stores lastSessionDate in local time (browser timezone).
// Cloud Functions must use the same timezone for streak comparisons.
// sv-SE locale guarantees YYYY-MM-DD format.
const TZ = 'Europe/Paris';
function todayParis() {
    return new Date().toLocaleDateString('sv-SE', { timeZone: TZ });
}
function yesterdayParis() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('sv-SE', { timeZone: TZ });
}
// ─── Scheduled: Reset expired streaks (daily at 03:00 Europe/Paris) ──────────
// Queries all users whose streak > 0 and lastSessionDate is older than yesterday.
// Updates bestStreak if current streak exceeds it, then resets streak to 0.
exports.resetExpiredStreaks = (0, scheduler_1.onSchedule)({ schedule: '0 3 * * *', timeZone: TZ, region: 'europe-west1' }, async () => {
    const yesterday = yesterdayParis();
    // Users with an active streak whose last session was NOT today and NOT yesterday
    // Since Firestore doesn't support != combined with >, we query streak > 0
    // and filter in-memory on lastSessionDate.
    const snapshot = await db
        .collection('users')
        .where('streak', '>', 0)
        .get();
    if (snapshot.empty) {
        console.log('[resetExpiredStreaks] No users with active streak.');
        return;
    }
    const today = todayParis();
    const batch = db.batch();
    let count = 0;
    for (const doc of snapshot.docs) {
        const data = doc.data();
        const lastDate = data.lastSessionDate;
        // If lastSessionDate is today or yesterday, the streak is still valid
        if (lastDate === today || lastDate === yesterday)
            continue;
        const currentStreak = data.streak;
        const bestStreak = data.bestStreak ?? 0;
        const updates = { streak: 0 };
        if (currentStreak > bestStreak) {
            updates.bestStreak = currentStreak;
        }
        batch.update(doc.ref, updates);
        count++;
    }
    if (count > 0) {
        await batch.commit();
    }
    console.log(`[resetExpiredStreaks] Reset ${count} expired streaks.`);
    // ── Purge old notification documents (> 7 days) ──────────────
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - 7);
    const usersSnap = await db.collection('users').select().get();
    let purged = 0;
    for (const userDoc of usersSnap.docs) {
        const notifSnap = await userDoc.ref
            .collection('notifications')
            .where('sentAt', '<', cutoff)
            .limit(500)
            .get();
        if (notifSnap.empty)
            continue;
        const purgeBatch = db.batch();
        for (const notifDoc of notifSnap.docs) {
            purgeBatch.delete(notifDoc.ref);
            purged++;
        }
        await purgeBatch.commit();
    }
    console.log(`[resetExpiredStreaks] Purged ${purged} old notifications.`);
});
// ─── Scheduled: Streak reminder notification (daily at 18:00 Europe/Paris) ───
// Sends a motivational push notification to users who have an active streak
// but haven't done a session today yet.
const STREAK_REMINDER_MESSAGES = [
    {
        minStreak: 30,
        pool: [
            '🔥 {streak} days strong! Legends don\'t quit — one session to keep the fire alive!',
            '👑 {streak}-day streak! You\'re in the top tier — don\'t let it slip!',
            '🏆 {streak} days! That\'s elite-level commitment. Keep going, champion!',
        ],
    },
    {
        minStreak: 14,
        pool: [
            '🔥 {streak} days in a row! You\'re on a serious roll — keep it up!',
            '💪 Don\'t break your {streak}-day streak! A quick session is all it takes.',
            '🚀 {streak} days! You\'re building something amazing — push through today!',
        ],
    },
    {
        minStreak: 7,
        pool: [
            '🔥 {streak}-day streak! One week strong — let\'s make it two!',
            '💥 {streak} days! You\'re on fire — don\'t let it go out!',
            '✨ A full week of grind! Keep that {streak}-day streak alive!',
        ],
    },
    {
        minStreak: 3,
        pool: [
            '🔥 {streak} days in a row! Momentum is building — keep pushing!',
            '💪 {streak}-day streak! You\'re getting consistent — don\'t stop now!',
            '🎯 {streak} days! Small streaks become big ones — do a quick session!',
        ],
    },
    {
        minStreak: 1,
        pool: [
            '🔥 You trained yesterday — come back today to start a streak!',
            '💪 Don\'t lose your momentum! A quick session keeps you on track.',
            '🎯 One more day and your streak grows — let\'s go!',
        ],
    },
];
function getStreakMessage(streak) {
    for (const tier of STREAK_REMINDER_MESSAGES) {
        if (streak >= tier.minStreak) {
            const template = tier.pool[Math.floor(Math.random() * tier.pool.length)];
            return template.replace('{streak}', String(streak));
        }
    }
    return '💪 Time for a workout — start building your streak today!';
}
exports.sendStreakReminders = (0, scheduler_1.onSchedule)({ schedule: '0 18 * * *', timeZone: TZ, region: 'europe-west1' }, async () => {
    const today = todayParis();
    // Query users with an active streak AND an FCM token
    const snapshot = await db
        .collection('users')
        .where('streak', '>', 0)
        .get();
    if (snapshot.empty) {
        console.log('[sendStreakReminders] No users with active streak.');
        return;
    }
    let sent = 0;
    let skipped = 0;
    const sendPromises = [];
    for (const doc of snapshot.docs) {
        const data = doc.data();
        const token = data.fcmToken;
        const lastDate = data.lastSessionDate;
        const streak = data.streak;
        // Skip if no FCM token (user hasn't granted push permission)
        if (!token) {
            skipped++;
            continue;
        }
        // Skip if user already trained today — no need to remind
        if (lastDate === today) {
            skipped++;
            continue;
        }
        const body = getStreakMessage(streak);
        sendPromises.push(sendPush(token, '🔥 Your streak is at risk!', body, 'streak_reminder')
            .then(() => { sent++; })
            .catch(async (err) => {
            const isInvalidToken = err instanceof Error &&
                (err.message.includes('registration-token-not-registered') ||
                    err.message.includes('invalid-registration-token'));
            if (isInvalidToken) {
                await db.doc(`users/${doc.id}`).update({
                    fcmToken: admin.firestore.FieldValue.delete(),
                });
            }
            else {
                console.error(`[sendStreakReminders] FCM error for ${doc.id}:`, err);
            }
            skipped++;
        }));
    }
    await Promise.all(sendPromises);
    console.log(`[sendStreakReminders] Sent: ${sent}, Skipped: ${skipped}`);
});
//# sourceMappingURL=index.js.map