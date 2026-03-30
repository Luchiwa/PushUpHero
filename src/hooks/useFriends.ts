import { useState, useEffect, useCallback, useRef } from 'react';
import {
    collection, doc, getDoc, setDoc, deleteDoc, getDocs,
    onSnapshot, addDoc, serverTimestamp, updateDoc, increment,
    query, where, documentId,
} from 'firebase/firestore';
import { db } from '@lib/firebase';
import { useAuthCore } from './useAuth';

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

export type SearchResult = {
    uid: string;
    displayName: string;
    level: number;
    totalReps: number;
    totalSessions: number;
    /** relationship from current user's perspective */
    relation: 'none' | 'friend' | 'request_sent' | 'request_received' | 'self';
};

// ── Batched stats fetch ─────────────────────────────────────────
// Replaces per-friend onSnapshot listeners with batched 'in' queries.
// Firestore 'in' query limit = 30, so we batch in groups of 30.

const STATS_BATCH_SIZE = 30;
const STATS_DEBOUNCE_MS = 300;

type FriendStats = Pick<Friend, 'level' | 'totalReps' | 'totalSessions' | 'photoURL' | 'photoThumb' | 'streak'>;

async function batchFetchProfileStats(uids: string[]): Promise<Map<string, FriendStats>> {
    const stats = new Map<string, FriendStats>();
    for (let i = 0; i < uids.length; i += STATS_BATCH_SIZE) {
        const batch = uids.slice(i, i + STATS_BATCH_SIZE);
        const q = query(collection(db, 'users'), where(documentId(), 'in', batch));
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

export function useFriends() {
    const { user, dbUser } = useAuthCore();

    const [friends, setFriends] = useState<Friend[]>([]);
    const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
    const [outgoingRequests, setOutgoingRequests] = useState<OutgoingRequest[]>([]);

    const statsDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    // ── Realtime listeners ──────────────────────────────────────────
    useEffect(() => {
        const debounceRef = statsDebounceRef;

        if (!user) {
            setTimeout(() => {
                setFriends([]);
                setIncomingRequests([]);
                setOutgoingRequests([]);
            }, 0);
            return;
        }

        // Listen to confirmed friends list, then batch-fetch profile stats
        const friendsRef = collection(db, 'users', user.uid, 'friends');
        const unsubFriends = onSnapshot(friendsRef, snap => {
            const entries = snap.docs.map(d => {
                const data = d.data();
                return {
                    uid: (data.uid ?? d.id) as string,
                    displayName: (data.displayName ?? '') as string,
                    photoURL: data.photoURL as string | undefined,
                };
            });

            // Update friend list immediately with basic info (stats filled by batch fetch)
            setFriends(prev => {
                const prevMap = new Map(prev.map(f => [f.uid, f]));
                return entries.map(e => {
                    const existing = prevMap.get(e.uid);
                    if (existing) {
                        return {
                            ...existing,
                            displayName: e.displayName || existing.displayName,
                            photoURL: e.photoURL ?? existing.photoURL,
                        };
                    }
                    return { ...e, level: 0, totalReps: 0, totalSessions: 0, streak: 0 };
                });
            });

            // Debounced batch fetch for profile stats (level, totalReps, etc.)
            clearTimeout(debounceRef.current);
            const uids = entries.map(e => e.uid);
            if (uids.length > 0) {
                debounceRef.current = setTimeout(async () => {
                    try {
                        const stats = await batchFetchProfileStats(uids);
                        setFriends(prev => prev.map(f => {
                            const s = stats.get(f.uid);
                            return s ? { ...f, ...s } : f;
                        }));
                    } catch (err) {
                        console.error('[useFriends] batch stats fetch error:', err);
                    }
                }, STATS_DEBOUNCE_MS);
            }
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
            clearTimeout(debounceRef.current);
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
        // Track total encouragements sent for achievements
        await updateDoc(doc(db, 'users', user.uid), {
            totalEncouragementsSent: increment(1),
        });
    }, [user, dbUser]);

    // ── Remove friend ───────────────────────────────────────────────
    const removeFriend = useCallback(async (friendUid: string) => {
        if (!user) return;
        await deleteDoc(doc(db, 'users', user.uid, 'friends', friendUid));
        await deleteDoc(doc(db, 'users', friendUid, 'friends', user.uid));
    }, [user]);

    // ── Refresh stats on demand ─────────────────────────────────────
    const refreshFriendStats = useCallback(async () => {
        const uids = friends.map(f => f.uid);
        if (uids.length === 0) return;
        try {
            const stats = await batchFetchProfileStats(uids);
            setFriends(prev => prev.map(f => {
                const s = stats.get(f.uid);
                return s ? { ...f, ...s } : f;
            }));
        } catch (err) {
            console.error('[useFriends] refresh stats error:', err);
        }
    }, [friends]);

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
        refreshFriendStats,
    };
}
