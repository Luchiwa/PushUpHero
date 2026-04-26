/**
 * sessionRepository — Firestore read operations for workout sessions.
 *
 * Encapsulates all session queries so hooks never import firebase/firestore directly.
 */

import { onSnapshot, query, orderBy, limit, where, getDocs } from 'firebase/firestore';
import { sessionsCol } from '@infra/refs';
import { isSessionRecord } from '@infra/firestoreValidators';
import type { SessionRecord } from '@exercises/types';
import type { UserId } from '@domain';

function parseSessionDocs(rawDocs: { data: () => unknown }[], context: string): SessionRecord[] {
    const out: SessionRecord[] = [];
    for (const d of rawDocs) {
        const data = d.data();
        if (isSessionRecord(data)) {
            out.push(data);
        } else {
            console.warn(`[sessionRepository] Invalid session doc skipped (${context})`, data);
        }
    }
    return out;
}

/** Real-time listener on the last N sessions (default 5). Returns unsubscribe. */
export function onRecentSessions(
    uid: UserId,
    callback: (sessions: SessionRecord[]) => void,
    count = 5,
): () => void {
    const q = query(sessionsCol(uid), orderBy('date', 'desc'), limit(count));
    return onSnapshot(q, (snap) => {
        callback(parseSessionDocs(snap.docs, 'onRecentSessions'));
    });
}

/** Fetch sessions within a date range (ms timestamps), ordered by date desc. */
export async function getSessionsByDateRange(
    uid: UserId,
    startMs: number,
    endMs: number,
    maxResults = 200,
): Promise<SessionRecord[]> {
    const q = query(
        sessionsCol(uid),
        where('date', '>=', startMs),
        where('date', '<=', endMs),
        orderBy('date', 'desc'),
        limit(maxResults),
    );
    const snap = await getDocs(q);
    return parseSessionDocs(snap.docs, 'getSessionsByDateRange');
}

/** Fetch the oldest session date (ms timestamp). Returns null if no valid sessions exist. */
export async function getOldestSessionDate(uid: UserId): Promise<number | null> {
    const q = query(sessionsCol(uid), orderBy('date', 'asc'), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const data = snap.docs[0].data();
    if (!isSessionRecord(data)) {
        console.warn('[sessionRepository] Invalid oldest session doc', data);
        return null;
    }
    return data.date;
}
