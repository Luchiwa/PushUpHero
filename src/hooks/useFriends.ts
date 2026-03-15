import { useState, useEffect, useCallback, useRef } from 'react';
import {
    collection, doc, getDoc, setDoc, deleteDoc,
    onSnapshot, addDoc, serverTimestamp
} from 'firebase/firestore';
import { db } from '@lib/firebase';
import { useAuth } from './useAuth';

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
    streak?: number;
}

export type SearchResult = {
    uid: string;
    displayName: string;
    level: number;
    totalReps: number;
    totalSessions: number;
    /** relationship from current user's perspective */
    relation: 'none' | 'friend' | 'request_sent' | 'request_received' | 'self';
};

export function useFriends() {
    const { user, dbUser } = useAuth();

    const [friends, setFriends] = useState<Friend[]>([]);
    const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
    const [outgoingRequests, setOutgoingRequests] = useState<OutgoingRequest[]>([]);

    // Holds unsub functions for per-friend profile listeners
    const profileUnsubsRef = useRef<Map<string, () => void>>(new Map());

    // ── Realtime listeners ──────────────────────────────────────────
    useEffect(() => {
        if (!user) {
            setTimeout(() => {
                setFriends([]);
                setIncomingRequests([]);
                setOutgoingRequests([]);
            }, 0);
            // Clean up any profile listeners
            profileUnsubsRef.current.forEach(unsub => unsub());
            profileUnsubsRef.current.clear();
            return;
        }

        // Listen to confirmed friends list, then attach per-profile listeners
        const friendsRef = collection(db, 'users', user.uid, 'friends');
        const unsubFriends = onSnapshot(friendsRef, snap => {
            const currentUids = new Set(snap.docs.map(d => d.id));

            // Remove listeners for friends that were removed
            profileUnsubsRef.current.forEach((unsub, uid) => {
                if (!currentUids.has(uid)) {
                    unsub();
                    profileUnsubsRef.current.delete(uid);
                }
            });

            // Set initial list first — stats at 0, profile snapshots will fill them in.
            // Must come BEFORE attaching listeners so the listener updates are never overwritten.
            setFriends(snap.docs.map(d => {
                const data = d.data();
                return {
                    uid: data.uid,
                    displayName: data.displayName,
                    photoURL: data.photoURL ?? undefined,
                    level: 0,
                    totalReps: 0,
                    totalSessions: 0,
                    streak: 0,
                } as Friend;
            }));

            // Attach per-profile live listeners for stats (level, totalReps, totalSessions, streak)
            snap.docs.forEach(friendDoc => {
                const uid = friendDoc.id;
                if (!profileUnsubsRef.current.has(uid)) {
                    const unsub = onSnapshot(doc(db, 'users', uid), profileSnap => {
                        if (!profileSnap.exists()) return;
                        const p = profileSnap.data();
                        setFriends(prev => prev.map(f =>
                            f.uid === uid
                                ? {
                                    ...f,
                                    level: p.level ?? 0,
                                    totalReps: p.totalReps ?? 0,
                                    totalSessions: p.totalSessions ?? 0,
                                    photoURL: p.photoURL ?? f.photoURL,
                                    streak: p.streak ?? 0,
                                }
                                : f
                        ));
                    });
                    profileUnsubsRef.current.set(uid, unsub);
                }
            });
        });

        // Listen to incoming friend requests
        const requestsRef = collection(db, 'users', user.uid, 'friendRequests');
        const unsubRequests = onSnapshot(requestsRef, snap => {
            setIncomingRequests(snap.docs.map(d => d.data() as FriendRequest));
        });

        // Listen to outgoing requests (requests I sent, stored in my own subcollection)
        const outgoingRef = collection(db, 'users', user.uid, 'friendRequestsSent');
        const unsubOutgoing = onSnapshot(outgoingRef, async snap => {
            const requests = await Promise.all(
                snap.docs.map(async d => {
                    const data = d.data();
                    // toUsername may already be stored; if not, fetch the profile
                    let toUsername: string = data.toUsername || '';
                    if (!toUsername) {
                        const profileSnap = await getDoc(doc(db, 'users', d.id));
                        toUsername = profileSnap.exists()
                            ? (profileSnap.data().displayName || d.id)
                            : d.id;
                    }
                    return { toUid: d.id, toUsername, sentAt: data.sentAt || 0 } as OutgoingRequest;
                })
            );
            setOutgoingRequests(requests);
        });

        return () => {
            unsubFriends();
            unsubRequests();
            unsubOutgoing();
            profileUnsubsRef.current.forEach(unsub => unsub());
            profileUnsubsRef.current.clear();
        };
    }, [user]);

    // ── Search by username ──────────────────────────────────────────
    const searchByUsername = useCallback(async (username: string): Promise<SearchResult | null> => {
        if (!user || !username.trim()) return null;

        const cleanUsername = username.trim().toLowerCase();

        // Look up uid from the usernames collection
        const usernameDoc = await getDoc(doc(db, 'usernames', cleanUsername));
        if (!usernameDoc.exists()) return null;

        const targetUid = usernameDoc.data().uid as string;

        if (targetUid === user.uid) {
            return null; // can't add yourself
        }

        // Fetch their profile
        const profileDoc = await getDoc(doc(db, 'users', targetUid));
        if (!profileDoc.exists()) return null;

        const profile = profileDoc.data();

        // Determine relationship
        let relation: SearchResult['relation'] = 'none';
        if (friends.some(f => f.uid === targetUid)) {
            relation = 'friend';
        } else if (outgoingRequests.some(r => r.toUid === targetUid)) {
            relation = 'request_sent';
        } else if (incomingRequests.some(r => r.fromUid === targetUid)) {
            relation = 'request_received';
        }

        return {
            uid: targetUid,
            displayName: profile.displayName || username,
            level: profile.level || 0,
            totalReps: profile.totalReps || 0,
            totalSessions: profile.totalSessions || 0,
            relation,
        };
    }, [user, friends, outgoingRequests, incomingRequests]);

    // ── Send friend request ─────────────────────────────────────────
    const sendFriendRequest = useCallback(async (toUid: string, _toUsername: string) => {
        if (!user || !dbUser) return;

        const myUsername = dbUser.displayName;

        // Write to target's incoming requests
        await setDoc(doc(db, 'users', toUid, 'friendRequests', user.uid), {
            fromUid: user.uid,
            fromUsername: myUsername,
            status: 'pending',
            sentAt: Date.now(),
        });

        // Write to my own sent tracker (store toUsername to avoid extra reads later)
        const toUsername = _toUsername;
        await setDoc(doc(db, 'users', user.uid, 'friendRequestsSent', toUid), {
            toUid,
            toUsername,
            sentAt: Date.now(),
        });

        // Notify the recipient
        await addDoc(collection(db, 'users', toUid, 'notifications'), {
            type: 'friend_request',
            fromUid: user.uid,
            fromUsername: myUsername,
            sentAt: serverTimestamp(),
            read: false,
        });
    }, [user, dbUser]);

    // ── Accept friend request ───────────────────────────────────────
    const acceptFriendRequest = useCallback(async (request: FriendRequest) => {
        if (!user || !dbUser) return;

        // Add them to my friends (stats come from live profile snapshot, not stored here)
        await setDoc(doc(db, 'users', user.uid, 'friends', request.fromUid), {
            uid: request.fromUid,
            displayName: request.fromUsername,
        });

        // Add me to their friends
        await setDoc(doc(db, 'users', request.fromUid, 'friends', user.uid), {
            uid: user.uid,
            displayName: dbUser.displayName,
        });

        // Delete the incoming request
        await deleteDoc(doc(db, 'users', user.uid, 'friendRequests', request.fromUid));

        // Delete from their sent tracker
        await deleteDoc(doc(db, 'users', request.fromUid, 'friendRequestsSent', user.uid));
    }, [user, dbUser]);

    // ── Decline friend request ──────────────────────────────────────
    const declineFriendRequest = useCallback(async (fromUid: string) => {
        if (!user) return;
        await deleteDoc(doc(db, 'users', user.uid, 'friendRequests', fromUid));
        await deleteDoc(doc(db, 'users', fromUid, 'friendRequestsSent', user.uid));
    }, [user]);

    // ── Cancel outgoing request ─────────────────────────────────────
    const cancelFriendRequest = useCallback(async (toUid: string) => {
        if (!user) return;
        await deleteDoc(doc(db, 'users', toUid, 'friendRequests', user.uid));
        await deleteDoc(doc(db, 'users', user.uid, 'friendRequestsSent', toUid));
    }, [user]);

    // ── Send encouragement ─────────────────────────────────────────
    const sendEncouragement = useCallback(async (toUid: string) => {
        if (!user || !dbUser) return;
        await addDoc(collection(db, 'users', toUid, 'notifications'), {
            type: 'encouragement',
            fromUid: user.uid,
            fromUsername: dbUser.displayName,
            sentAt: serverTimestamp(),
            read: false,
        });
    }, [user, dbUser]);

    // ── Remove friend ───────────────────────────────────────────────
    const removeFriend = useCallback(async (friendUid: string) => {
        if (!user) return;
        await deleteDoc(doc(db, 'users', user.uid, 'friends', friendUid));
        await deleteDoc(doc(db, 'users', friendUid, 'friends', user.uid));
    }, [user]);

    return {
        friends,
        incomingRequests,
        outgoingRequests,
        searchByUsername,
        sendFriendRequest,
        acceptFriendRequest,
        declineFriendRequest,
        cancelFriendRequest,
        sendEncouragement,
        removeFriend,
    };
}
