/**
 * refs.ts — Centralised Firestore document & collection references.
 *
 * Single source of truth for collection paths.
 * Eliminates string duplication across hooks, services, and providers.
 */

import { doc, collection } from 'firebase/firestore';
import { db } from './firebase';

// ── Users ───────────────────────────────────────────────────────────────────

/** `users` collection root (for queries like `where(documentId(), 'in', …)`) */
export const usersCol = () => collection(db, 'users');

/** `users/{uid}` document ref */
export const userRef = (uid: string) => doc(db, 'users', uid);

/** `usernames/{username}` document ref (username → uid mapping) */
export const usernameRef = (username: string) => doc(db, 'usernames', username);

// ── Sessions ────────────────────────────────────────────────────────────────

/** `users/{uid}/sessions` collection ref */
export const sessionsCol = (uid: string) => collection(db, 'users', uid, 'sessions');

/** `users/{uid}/sessions/{sessionId}` document ref */
export const sessionRef = (uid: string, sessionId: string) =>
    doc(collection(db, 'users', uid, 'sessions'), sessionId);

// ── Friends ─────────────────────────────────────────────────────────────────

/** `users/{uid}/friends` collection ref */
export const friendsCol = (uid: string) => collection(db, 'users', uid, 'friends');

/** `users/{uid}/friends/{friendUid}` document ref */
export const friendRef = (uid: string, friendUid: string) =>
    doc(db, 'users', uid, 'friends', friendUid);

// ── Friend Requests ─────────────────────────────────────────────────────────

/** `users/{uid}/friendRequests` collection ref (incoming) */
export const friendRequestsCol = (uid: string) => collection(db, 'users', uid, 'friendRequests');

/** `users/{uid}/friendRequests/{fromUid}` document ref */
export const friendRequestRef = (uid: string, fromUid: string) =>
    doc(db, 'users', uid, 'friendRequests', fromUid);

/** `users/{uid}/friendRequestsSent` collection ref (outgoing) */
export const sentRequestsCol = (uid: string) => collection(db, 'users', uid, 'friendRequestsSent');

/** `users/{uid}/friendRequestsSent/{toUid}` document ref */
export const sentRequestRef = (uid: string, toUid: string) =>
    doc(db, 'users', uid, 'friendRequestsSent', toUid);

// ── Activity Feed ───────────────────────────────────────────────────────────

/** `users/{uid}/activityFeed` collection ref */
export const activityFeedCol = (uid: string) => collection(db, 'users', uid, 'activityFeed');

// ── Notifications ───────────────────────────────────────────────────────────

/** `users/{uid}/notifications` collection ref */
export const notificationsCol = (uid: string) => collection(db, 'users', uid, 'notifications');

/** `users/{uid}/notifications/{notifId}` document ref */
export const notificationRef = (uid: string, notifId: string) =>
    doc(db, 'users', uid, 'notifications', notifId);
