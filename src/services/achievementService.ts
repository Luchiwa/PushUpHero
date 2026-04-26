/**
 * achievementService.ts
 *
 * Live achievement checks — evaluates achievements that depend on state
 * changing outside of sessions (social: friends count, encouragements)
 * and persists any newly unlocked achievements to Firestore.
 */

import { updateDoc } from 'firebase/firestore';
import { userRef } from '@infra/refs';
import { evaluateAchievements } from '@domain';
import type { UserStats, AchievementMap } from '@domain';
import type { AchievementDef } from '@domain';
import type { UserId } from '@domain';

export async function checkLiveAchievements(
    uid: UserId,
    stats: UserStats,
    currentAchievements: AchievementMap,
): Promise<AchievementDef[]> {
    const newlyUnlocked = evaluateAchievements(stats, currentAchievements);
    if (newlyUnlocked.length === 0) return [];

    // currentAchievements was mutated in-place by evaluateAchievements (timestamps added)
    await updateDoc(userRef(uid), { achievements: currentAchievements });

    return newlyUnlocked;
}
