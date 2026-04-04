/**
 * sessionRepository — Firestore read operations for workout sessions.
 *
 * Encapsulates all session queries so hooks never import firebase/firestore directly.
 */

import { onSnapshot, query, orderBy, limit, where, getDocs } from 'firebase/firestore';
import { sessionsCol } from '@infra/refs';
import type { SessionRecord } from '@exercises/types';

/** Real-time listener on the last N sessions (default 5). Returns unsubscribe. */
export function onRecentSessions(
    uid: string,
    callback: (sessions: SessionRecord[]) => void,
    count = 5,
): () => void {
    const q = query(sessionsCol(uid), orderBy('date', 'desc'), limit(count));
    return onSnapshot(q, (snap) => {
        callback(snap.docs.map(d => d.data() as SessionRecord));
    });
}

/** Fetch sessions within a date range (ms timestamps), ordered by date desc. */
export async function getSessionsByDateRange(
    uid: string,
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
    return snap.docs.map(d => d.data() as SessionRecord);
}

/** Fetch the oldest session date (ms timestamp). Returns null if no sessions exist. */
export async function getOldestSessionDate(uid: string): Promise<number | null> {
    const q = query(sessionsCol(uid), orderBy('date', 'asc'), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return (snap.docs[0].data() as SessionRecord).date;
}
