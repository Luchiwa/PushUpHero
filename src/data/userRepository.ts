/**
 * userRepository — Firestore read operations for user profiles.
 *
 * Encapsulates user document listeners so hooks/providers never import
 * firebase/firestore directly.
 */

import { onSnapshot } from 'firebase/firestore';
import { userRef } from '@infra/refs';
import { isFlatUserDoc, type FlatUserDoc } from '@infra/firestoreValidators';
import { createUserId, createLevel, createXpAmount, type DbUser, type UserId } from '@domain';
import { isSupportedLanguage } from '@i18n/types';

/**
 * Unfolds the flat Firestore wire shape into the nested domain `DbUser`.
 * Lives at the repo boundary so the rest of the app reasons about
 * `dbUser.profile.displayName`, `dbUser.stats.totalXp`, etc. while
 * Firestore continues to store flat fields (no migration required).
 *
 * Also mints branded primitives (UserId, Level, XpAmount) — this is the
 * only mint point on the read path; everything downstream consumes brands.
 */
function unfoldDbUser(flat: FlatUserDoc): DbUser {
    return {
        uid: createUserId(flat.uid),
        profile: {
            displayName: flat.displayName,
            photoURL: flat.photoURL,
            photoThumb: flat.photoThumb,
            createdAt: flat.createdAt,
            preferredLanguage: isSupportedLanguage(flat.preferredLanguage) ? flat.preferredLanguage : undefined,
        },
        stats: {
            level: createLevel(flat.level),
            totalXp: createXpAmount(flat.totalXp),
            totalReps: flat.totalReps,
            totalSessions: flat.totalSessions,
            streak: flat.streak,
            bestStreak: flat.bestStreak,
            lastSessionDate: flat.lastSessionDate,
            lifetimeTrainingTime: flat.lifetimeTrainingTime,
            sGradeCount: flat.sGradeCount,
            totalEncouragementsSent: flat.totalEncouragementsSent,
        },
        progression: {
            exerciseXp: flat.exerciseXp,
            exerciseLevels: flat.exerciseLevels,
            lifetimeReps: flat.lifetimeReps,
        },
        achievements: flat.achievements,
        records: flat.records,
        bodyProfile: flat.bodyProfile,
        questProgress: flat.questProgress,
    };
}

/**
 * Real-time listener on a user profile document.
 * Calls `onData` with a validated, domain-shaped DbUser, or `onMissing`
 * if the doc doesn't exist. Malformed docs are skipped with a
 * console.warn — never propagated to the UI.
 * Returns unsubscribe function.
 */
export function onUserProfile(
    uid: UserId,
    onData: (data: DbUser) => void,
    onMissing?: () => void,
): () => void {
    return onSnapshot(userRef(uid), (snap) => {
        if (!snap.exists()) {
            onMissing?.();
            return;
        }
        const data = snap.data();
        if (!isFlatUserDoc(data)) {
            console.warn('[userRepository] Invalid user doc', uid, data);
            return;
        }
        onData(unfoldDbUser(data));
    });
}

/**
 * Real-time listener on a partial user document — returns the **flat**
 * Firestore wire shape so sync hooks can opportunistically read raw
 * fields (incl. legacy ones) without paying the cost of unfolding a
 * potentially incomplete doc into the nested domain shape.
 *
 * Consumers are expected to be repo/sync code, not UI components.
 */
export function onUserDoc(
    uid: UserId,
    onData: (data: Partial<FlatUserDoc>) => void,
    onMissing?: () => void,
): () => void {
    return onSnapshot(userRef(uid), (snap) => {
        if (!snap.exists()) {
            onMissing?.();
            return;
        }
        onData(snap.data() as Partial<FlatUserDoc>);
    });
}
