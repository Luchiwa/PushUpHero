/**
 * friendRepository — Firestore read operations for the friends system.
 *
 * Encapsulates all friend/request listeners so hooks never import
 * firebase/firestore directly.
 */

import { documentId, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { usersCol, friendsCol, friendRequestsCol, sentRequestsCol } from '@infra/refs';
import { isFriendRequest, tsToMs } from '@infra/firestoreValidators';
import type { FriendRequest, OutgoingRequest } from '@services/friendService';
import type { UserId } from '@domain';
import { createUserId } from '@domain';

/** Firestore `in` operator hard limit. */
const IN_QUERY_CHUNK = 30;

export interface FriendEntry {
    uid: UserId;
    displayName: string;
    photoURL?: string;
}

/** Real-time listener on confirmed friends. Returns unsubscribe. */
export function onFriendsList(
    uid: UserId,
    callback: (entries: FriendEntry[]) => void,
): () => void {
    return onSnapshot(friendsCol(uid), snap => {
        callback(snap.docs.map(d => {
            const data = d.data() as { uid?: string; displayName?: string; photoURL?: string };
            return {
                uid: createUserId(data.uid ?? d.id),
                displayName: data.displayName ?? '',
                photoURL: data.photoURL,
            };
        }));
    });
}

/** Real-time listener on incoming friend requests. Returns unsubscribe. */
export function onIncomingRequests(
    uid: UserId,
    callback: (requests: FriendRequest[]) => void,
): () => void {
    return onSnapshot(friendRequestsCol(uid), snap => {
        const requests: FriendRequest[] = [];
        for (const d of snap.docs) {
            const data = d.data();
            if (isFriendRequest(data)) {
                requests.push(data);
            } else {
                console.warn('[friendRepository] Invalid incoming request skipped', d.id);
            }
        }
        callback(requests);
    });
}

/**
 * Real-time listener on outgoing friend requests.
 *
 * The listener callback is **synchronous** — it maps each doc to an
 * OutgoingRequest using the denormalized `toUsername` field that
 * `friendService.sendFriendRequest` writes alongside the request.
 *
 * Legacy docs (created before denormalization) may lack `toUsername`. For
 * those, we emit an optimistic OutgoingRequest with `toUsername = uid` first,
 * then fire a single batched `where(documentId(), 'in', chunk)` query
 * (chunked at 30, the Firestore hard limit) to enrich and re-emit.
 *
 * The enrich continuation is guarded against (a) unsubscription, and (b) a
 * newer snapshot landing while the fetch is in flight — without these guards
 * a stale enriched callback could overwrite canonical state.
 *
 * Returns unsubscribe.
 */
export function onOutgoingRequests(
    uid: UserId,
    callback: (requests: OutgoingRequest[]) => void,
): () => void {
    let cancelled = false;
    let snapshotSeq = 0;

    const unsub = onSnapshot(sentRequestsCol(uid), snap => {
        const mySeq = ++snapshotSeq;
        const requests: OutgoingRequest[] = snap.docs.map(d => {
            const data = d.data() as { toUsername?: string; sentAt?: unknown };
            return {
                toUid: createUserId(d.id),
                toUsername: data.toUsername || d.id,
                sentAt: tsToMs(data.sentAt),
            };
        });

        callback(requests);

        const missing = snap.docs
            .filter(d => !(d.data() as { toUsername?: string }).toUsername)
            .map(d => d.id);

        if (missing.length === 0) return;

        enrichOutgoingUsernames(missing).then(usernames => {
            if (cancelled || mySeq !== snapshotSeq || usernames.size === 0) return;
            const enriched = requests.map(r =>
                usernames.has(r.toUid) ? { ...r, toUsername: usernames.get(r.toUid)! } : r,
            );
            callback(enriched);
        }).catch(err => console.warn('[friendRepository] enrich legacy outgoing requests failed', err));
    });

    return () => { cancelled = true; unsub(); };
}

async function enrichOutgoingUsernames(uids: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    for (let i = 0; i < uids.length; i += IN_QUERY_CHUNK) {
        const chunk = uids.slice(i, i + IN_QUERY_CHUNK);
        const q = query(usersCol(), where(documentId(), 'in', chunk));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
            const name = (d.data() as { displayName?: string }).displayName;
            if (typeof name === 'string' && name.length > 0) {
                result.set(d.id, name);
            }
        }
    }
    return result;
}
