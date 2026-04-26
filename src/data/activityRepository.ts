/**
 * activityRepository — Firestore read operations for the activity feed.
 *
 * Encapsulates activity feed queries so hooks never import firebase/firestore.
 * Returns parsed domain shapes (`ActivityFeedDoc`) — no DocumentData / Timestamp leakage.
 */

import { query, orderBy, limit, getDocs } from 'firebase/firestore';
import { activityFeedCol } from '@infra/refs';
import { parseActivityFeedDoc, type ActivityFeedDoc } from '@infra/firestoreValidators';
import type { UserId } from '@domain/brands';

/**
 * Fetch the most recent activity events for a single user.
 * Malformed docs are skipped with a console.warn.
 */
export async function getRecentActivity(
    uid: UserId,
    count: number,
): Promise<ActivityFeedDoc[]> {
    const q = query(activityFeedCol(uid), orderBy('createdAt', 'desc'), limit(count));
    const snap = await getDocs(q);
    const out: ActivityFeedDoc[] = [];
    for (const d of snap.docs) {
        const parsed = parseActivityFeedDoc(d.id, d.data());
        if (parsed) {
            out.push(parsed);
        } else {
            console.warn('[activityRepository] Invalid activity doc skipped', d.id);
        }
    }
    return out;
}
