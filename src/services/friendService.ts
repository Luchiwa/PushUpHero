/**
 * friendService.ts
 *
 * Pure Firestore operations for the friends system — no React, no hooks.
 * Each function takes explicit UIDs/names so it's testable in isolation.
 */

import {
    getDoc, setDoc, deleteDoc, getDocs, addDoc,
    serverTimestamp, updateDoc, increment,
    query, where, documentId,
} from 'firebase/firestore';
import {
    usersCol, userRef, usernameRef,
    friendRef, friendRequestRef, sentRequestRef,
    notificationsCol,
} from '@infra/refs';

// ── Types (re-exported for consumers that only need types) ──────────────────

export interface FriendRequest {
    fromUid: string;
    fromUsername: string;
    status: 'pending';
    sentAt: number;
}

export interface OutgoingRequest {
    toUid: string;
    toUsername: string;
    sentAt: number;
}

export interface Friend {
    uid: string;
    displayName: string;
    level: number;
    totalReps: number;
    totalSessions: number;
    photoURL?: string;
    photoThumb?: string;
    streak?: number;
}

export type FriendStats = Pick<Friend, 'level' | 'totalReps' | 'totalSessions' | 'photoURL' | 'photoThumb' | 'streak'>;

export type SearchResult = {
    uid: string;
    displayName: string;
    level: number;
    totalReps: number;
    totalSessions: number;
    relation: 'none' | 'friend' | 'request_sent' | 'request_received' | 'self';
};

// ── Batched stats fetch ─────────────────────────────────────────────────────

const STATS_BATCH_SIZE = 30;

export async function batchFetchProfileStats(uids: string[]): Promise<Map<string, FriendStats>> {
    const stats = new Map<string, FriendStats>();
    for (let i = 0; i < uids.length; i += STATS_BATCH_SIZE) {
        const batch = uids.slice(i, i + STATS_BATCH_SIZE);
        const q = query(usersCol(), where(documentId(), 'in', batch));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
            const data = d.data();
            stats.set(d.id, {
                level: data.level ?? 0,
                totalReps: data.totalReps ?? 0,
                totalSessions: data.totalSessions ?? 0,
                photoURL: data.photoURL ?? undefined,
                photoThumb: data.photoThumb ?? undefined,
                streak: data.streak ?? 0,
            });
        }
    }
    return stats;
}

// ── Search ──────────────────────────────────────────────────────────────────

/** Search a user by username. Returns profile data (without relation). */
export async function searchUserByUsername(
    username: string, currentUid: string,
): Promise<{ uid: string; displayName: string; level: number; totalReps: number; totalSessions: number } | null> {
    const cleanUsername = username.trim().toLowerCase();
    const usernameDoc = await getDoc(usernameRef(cleanUsername));
    if (!usernameDoc.exists()) return null;

    const targetUid = usernameDoc.data().uid as string;
    if (targetUid === currentUid) return null;

    const profileDoc = await getDoc(userRef(targetUid));
    if (!profileDoc.exists()) return null;

    const profile = profileDoc.data();
    return {
        uid: targetUid,
        displayName: profile.displayName || username,
        level: profile.level || 0,
        totalReps: profile.totalReps || 0,
        totalSessions: profile.totalSessions || 0,
    };
}

// ── Friend request operations ───────────────────────────────────────────────

export async function sendFriendRequest(
    uid: string, displayName: string, toUid: string, toUsername: string,
): Promise<void> {
    await setDoc(friendRequestRef(toUid, uid), {
        fromUid: uid, fromUsername: displayName, status: 'pending', sentAt: Date.now(),
    });
    await setDoc(sentRequestRef(uid, toUid), {
        toUid, toUsername, sentAt: Date.now(),
    });
    await addDoc(notificationsCol(toUid), {
        type: 'friend_request', fromUid: uid, fromUsername: displayName, sentAt: serverTimestamp(), read: false,
    });
}

export async function acceptFriendRequest(
    uid: string, displayName: string, request: FriendRequest,
): Promise<void> {
    await setDoc(friendRef(uid, request.fromUid), {
        uid: request.fromUid, displayName: request.fromUsername,
    });
    await setDoc(friendRef(request.fromUid, uid), {
        uid, displayName,
    });
    await deleteDoc(friendRequestRef(uid, request.fromUid));
    await deleteDoc(sentRequestRef(request.fromUid, uid));
}

export async function declineFriendRequest(uid: string, fromUid: string): Promise<void> {
    await deleteDoc(friendRequestRef(uid, fromUid));
    await deleteDoc(sentRequestRef(fromUid, uid));
}

export async function cancelFriendRequest(uid: string, toUid: string): Promise<void> {
    await deleteDoc(friendRequestRef(toUid, uid));
    await deleteDoc(sentRequestRef(uid, toUid));
}

export async function removeFriend(uid: string, friendUid: string): Promise<void> {
    await deleteDoc(friendRef(uid, friendUid));
    await deleteDoc(friendRef(friendUid, uid));
}

// ── Social actions ──────────────────────────────────────────────────────────

export async function sendEncouragement(
    uid: string, displayName: string, toUid: string,
): Promise<void> {
    await addDoc(notificationsCol(toUid), {
        type: 'encouragement', fromUid: uid, fromUsername: displayName, sentAt: serverTimestamp(), read: false,
    });
    await updateDoc(userRef(uid), { totalEncouragementsSent: increment(1) });
}
