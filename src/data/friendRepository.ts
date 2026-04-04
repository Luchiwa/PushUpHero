/**
 * friendRepository — Firestore read operations for the friends system.
 *
 * Encapsulates all friend/request listeners so hooks never import
 * firebase/firestore directly.
 */

import { getDoc, onSnapshot } from 'firebase/firestore';
import { userRef, friendsCol, friendRequestsCol, sentRequestsCol } from '@infra/refs';
import type { FriendRequest, OutgoingRequest } from '@services/friendService';

export interface FriendEntry {
    uid: string;
    displayName: string;
    photoURL?: string;
}

/** Real-time listener on confirmed friends. Returns unsubscribe. */
export function onFriendsList(
    uid: string,
    callback: (entries: FriendEntry[]) => void,
): () => void {
    return onSnapshot(friendsCol(uid), snap => {
        callback(snap.docs.map(d => {
            const data = d.data();
            return {
                uid: (data.uid ?? d.id) as string,
                displayName: (data.displayName ?? '') as string,
                photoURL: data.photoURL as string | undefined,
            };
        }));
    });
}

/** Real-time listener on incoming friend requests. Returns unsubscribe. */
export function onIncomingRequests(
    uid: string,
    callback: (requests: FriendRequest[]) => void,
): () => void {
    return onSnapshot(friendRequestsCol(uid), snap => {
        callback(snap.docs.map(d => d.data() as FriendRequest));
    });
}

/** Real-time listener on outgoing friend requests. Returns unsubscribe. */
export function onOutgoingRequests(
    uid: string,
    callback: (requests: OutgoingRequest[]) => void,
): () => void {
    return onSnapshot(sentRequestsCol(uid), async snap => {
        const requests = await Promise.all(
            snap.docs.map(async d => {
                const data = d.data();
                let toUsername: string = data.toUsername || '';
                if (!toUsername) {
                    const profileSnap = await getDoc(userRef(d.id));
                    toUsername = profileSnap.exists()
                        ? (profileSnap.data().displayName || d.id)
                        : d.id;
                }
                return { toUid: d.id, toUsername, sentAt: data.sentAt || 0 } as OutgoingRequest;
            }),
        );
        callback(requests);
    });
}
