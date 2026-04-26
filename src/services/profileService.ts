/**
 * profileService.ts
 *
 * Field-level user profile updates — thin wrappers so hooks never
 * import firebase/firestore directly.
 */

import { updateDoc } from 'firebase/firestore';
import { userRef } from '@infra/refs';
import type { BodyProfile, QuestProgress, UserId, XpAmount } from '@domain';

export function updateBodyProfile(uid: UserId, profile: BodyProfile): Promise<void> {
    return updateDoc(userRef(uid), { bodyProfile: profile });
}

export function updateQuestProgress(uid: UserId, progress: QuestProgress): Promise<void> {
    return updateDoc(userRef(uid), { questProgress: progress });
}

/** Legacy migration: seed totalXp from the old level-based system. */
export function migrateLegacyXp(uid: UserId, totalXp: XpAmount): Promise<void> {
    return updateDoc(userRef(uid), { totalXp });
}
