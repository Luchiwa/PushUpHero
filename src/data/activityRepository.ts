/**
 * activityRepository — Firestore read operations for the activity feed.
 *
 * Encapsulates activity feed queries so hooks never import firebase/firestore.
 */

import { query, orderBy, limit, getDocs } from 'firebase/firestore';
import type { Timestamp, DocumentData } from 'firebase/firestore';
import { activityFeedCol } from '@lib/refs';

export interface RawActivityDoc {
    id: string;
    data: DocumentData;
    createdAtMs: number;
}

/**
 * Fetch the most recent activity events for a single user.
 * Returns raw document data — the caller maps to domain types.
 */
export async function getRecentActivity(
    uid: string,
    count: number,
): Promise<RawActivityDoc[]> {
    const q = query(activityFeedCol(uid), orderBy('createdAt', 'desc'), limit(count));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
        const data = d.data();
        const ts = data.createdAt as Timestamp | null;
        return {
            id: d.id,
            data,
            createdAtMs: ts ? ts.toMillis() : Date.now(),
        };
    });
}
