/**
 * profileService.ts
 *
 * Field-level user profile updates — thin wrappers so hooks never
 * import firebase/firestore directly.
 */

import { updateDoc } from 'firebase/firestore';
import { userRef } from '@infra/refs';
import type { BodyProfile } from '@domain/bodyProfile';
import type { QuestProgress } from '@domain/quests';

export function updateBodyProfile(uid: string, profile: BodyProfile): Promise<void> {
    return updateDoc(userRef(uid), { bodyProfile: profile });
}

export function updateQuestProgress(uid: string, progress: QuestProgress): Promise<void> {
    return updateDoc(userRef(uid), { questProgress: progress });
}

/** Legacy migration: seed totalXp from the old level-based system. */
export function migrateLegacyXp(uid: string, totalXp: number): Promise<void> {
    return updateDoc(userRef(uid), { totalXp });
}
