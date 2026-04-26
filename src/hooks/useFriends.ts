import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthCore } from './useAuth';
import { onFriendsList, onIncomingRequests, onOutgoingRequests } from '@data/friendRepository';
import {
    batchFetchProfileStats, searchUserByUsername,
    sendFriendRequest as sendRequest,
    acceptFriendRequest as acceptRequest,
    declineFriendRequest as declineRequest,
    cancelFriendRequest as cancelRequest,
    sendEncouragement as sendEnc,
    removeFriend as removeFr,
} from '@services/friendService';
import type { Friend, FriendRequest, OutgoingRequest, SearchResult } from '@services/friendService';

// Re-export types for consumers that import from here
export type { Friend, FriendRequest, OutgoingRequest, SearchResult } from '@services/friendService';

const STATS_DEBOUNCE_MS = 300;

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
        const unsubFriends = onFriendsList(user.uid, (entries) => {
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
        const unsubRequests = onIncomingRequests(user.uid, setIncomingRequests);

        // Listen to outgoing requests
        const unsubOutgoing = onOutgoingRequests(user.uid, setOutgoingRequests);

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

        const result = await searchUserByUsername(username, user.uid);
        if (!result) return null;

        let relation: SearchResult['relation'] = 'none';
        if (friends.some(f => f.uid === result.uid)) relation = 'friend';
        else if (outgoingRequests.some(r => r.toUid === result.uid)) relation = 'request_sent';
        else if (incomingRequests.some(r => r.fromUid === result.uid)) relation = 'request_received';

        return { ...result, relation };
    }, [user, friends, outgoingRequests, incomingRequests]);

    // ── Thin wrappers (inject uid/displayName from auth context) ────
    const sendFriendRequest = useCallback(async (toUid: string, toUsername: string) => {
        if (!user || !dbUser) return;
        await sendRequest(user.uid, dbUser.profile.displayName, toUid, toUsername);
    }, [user, dbUser]);

    const acceptFriendRequest = useCallback(async (request: FriendRequest) => {
        if (!user || !dbUser) return;
        await acceptRequest(user.uid, dbUser.profile.displayName, request);
    }, [user, dbUser]);

    const declineFriendRequest = useCallback(async (fromUid: string) => {
        if (!user) return;
        await declineRequest(user.uid, fromUid);
    }, [user]);

    const cancelFriendRequest = useCallback(async (toUid: string) => {
        if (!user) return;
        await cancelRequest(user.uid, toUid);
    }, [user]);

    const sendEncouragement = useCallback(async (toUid: string) => {
        if (!user || !dbUser) return;
        await sendEnc(user.uid, dbUser.profile.displayName, toUid);
    }, [user, dbUser]);

    const removeFriend = useCallback(async (friendUid: string) => {
        if (!user) return;
        await removeFr(user.uid, friendUid);
    }, [user]);

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
