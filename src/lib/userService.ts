/**
 * userService.ts
 *
 * Pure Firestore write functions — no React, no hooks, no state.
 * All user-data mutations go through here so they're easy to find,
 * test, and extend (e.g. new session fields, XP multipliers, achievements…).
 */

import {
    doc,
    collection,
    writeBatch,
    increment,
    serverTimestamp,
    getDocs,
    query,
    where,
    Timestamp,
    deleteDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { FEED_PRUNE_AGE_MS } from './constants';
import { calculateLevelFromTotalReps } from '@hooks/useLevelSystem';
import type { SessionRecord } from '@hooks/useSessionHistory';
import type { DbUser } from '@hooks/useAuth';

// ─── Date helpers ────────────────────────────────────────────────────────────

export function localDateString(date: Date = new Date()): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function yesterdayDateString(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return localDateString(d);
}

// ─── Streak helpers ───────────────────────────────────────────────────────────

/**
 * Compute the new streak value given the current user profile and today's date.
 * - Same day  → keep current streak (already counted today)
 * - Yesterday → extend by 1
 * - Anything else → reset to 1 (new streak)
 */
export function computeNewStreak(dbUser: DbUser | null, todayLocal: string): number {
    const lastDate = dbUser?.lastSessionDate;
    if (lastDate === todayLocal) return dbUser?.streak ?? 1;
    if (lastDate === yesterdayDateString()) return (dbUser?.streak ?? 0) + 1;
    return 1;
}

// ─── Core write: save a completed session ────────────────────────────────────

export interface SaveSessionParams {
    uid: string;
    session: SessionRecord;
    /** Lifetime reps BEFORE this session (already synced from Firestore via onSnapshot) */
    currentTotalReps: number;
    dbUser: DbUser | null;
}

/**
 * Atomically writes in one batch:
 *   1. The session document
 *   2. totalReps increment + level + streak + lastSessionDate on the user profile
 *   3. An activity feed event
 *
 * Fire-and-forget pruning of old feed events runs after the batch.
 */
export async function saveSession({ uid, session, currentTotalReps, dbUser }: SaveSessionParams): Promise<void> {
    const todayLocal = localDateString();
    const newTotal = currentTotalReps + session.reps;
    const newLevel = calculateLevelFromTotalReps(newTotal);
    const newStreak = computeNewStreak(dbUser, todayLocal);

    const batch = writeBatch(db);

    // 1. Session document
    const sessionRef = doc(collection(db, 'users', uid, 'sessions'), session.id);
    batch.set(sessionRef, session);

    // 2. User profile
    const userRef = doc(db, 'users', uid);
    batch.update(userRef, {
        totalReps: increment(session.reps),
        totalSessions: increment(1),
        level: newLevel,
        streak: newStreak,
        lastSessionDate: todayLocal,
    });

    // 3. Activity feed event
    const feedEvent: Record<string, unknown> = {
        type: 'session',
        reps: session.reps,
        averageScore: session.averageScore,
        sessionMode: session.sessionMode ?? 'reps',
        goalReps: session.goalReps,
        createdAt: serverTimestamp(),
    };
    if (session.elapsedTime !== undefined) feedEvent.elapsedTime = session.elapsedTime;
    if (session.numberOfSets !== undefined && session.numberOfSets > 1) feedEvent.numberOfSets = session.numberOfSets;
    const feedRef = doc(collection(db, 'users', uid, 'activityFeed'));
    batch.set(feedRef, feedEvent);

    await batch.commit();

    // Prune feed events older than 30 days — fire-and-forget, never blocks the save
    const cutoff = Timestamp.fromMillis(Date.now() - FEED_PRUNE_AGE_MS);
    getDocs(query(
        collection(db, 'users', uid, 'activityFeed'),
        where('createdAt', '<', cutoff),
    )).then(snap => snap.forEach(d => deleteDoc(d.ref))).catch(() => { /* non-critical */ });
}

// ─── Merge local guest data into Firestore on first login ────────────────────

export interface MergeLocalDataParams {
    uid: string;
    localReps: number;
    localSessions: SessionRecord[];
    cloudReps: number;
    cloudSessions: number;
}

export async function mergeLocalDataToCloud({
    uid,
    localReps,
    localSessions,
    cloudReps,
    cloudSessions,
}: MergeLocalDataParams): Promise<void> {
    const batch = writeBatch(db);
    const userRef = doc(db, 'users', uid);

    const newTotalReps = cloudReps + localReps;
    const newLevel = calculateLevelFromTotalReps(newTotalReps);
    batch.set(userRef, {
        totalReps: newTotalReps,
        totalSessions: cloudSessions + localSessions.length,
        level: newLevel,
    }, { merge: true });

    localSessions.forEach(session => {
        const sessionRef = doc(collection(db, 'users', uid, 'sessions'), session.id);
        batch.set(sessionRef, session);
    });

    await batch.commit();
}
