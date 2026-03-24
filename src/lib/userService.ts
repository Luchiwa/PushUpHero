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
import { levelFromTotalXp } from '@lib/xpSystem';
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
    /** Lifetime total XP BEFORE this session */
    currentTotalXp: number;
    /** XP earned this session (after bonuses) */
    sessionXp: number;
    /** Per-exercise XP earned this session */
    exerciseXpDeltas: { exerciseType: string; xp: number }[];
    /** Current per-exercise XP BEFORE this session */
    currentExerciseXp: Partial<Record<string, number>>;
    dbUser: DbUser | null;
}

/**
 * Atomically writes in one batch:
 *   1. The session document
 *   2. totalXp increment + level + exerciseXp + exerciseLevels + streak + lastSessionDate
 *   3. An activity feed event
 *
 * Fire-and-forget pruning of old feed events runs after the batch.
 */
export async function saveSession({ uid, session, currentTotalXp, sessionXp, exerciseXpDeltas, currentExerciseXp, dbUser }: SaveSessionParams): Promise<void> {
    const todayLocal = localDateString();
    const newTotalXp = currentTotalXp + sessionXp;
    const newLevel = levelFromTotalXp(newTotalXp);
    const newStreak = computeNewStreak(dbUser, todayLocal);

    // Compute new per-exercise XP and levels
    const newExerciseXp: Record<string, number> = {};
    for (const [type, xp] of Object.entries(currentExerciseXp)) {
        if (xp !== undefined) newExerciseXp[type] = xp;
    }
    const newExerciseLevels: Record<string, number> = {};
    for (const { exerciseType, xp } of exerciseXpDeltas) {
        newExerciseXp[exerciseType] = (newExerciseXp[exerciseType] ?? 0) + xp;
    }
    for (const [type, xp] of Object.entries(newExerciseXp)) {
        newExerciseLevels[type] = levelFromTotalXp(xp ?? 0);
    }

    const batch = writeBatch(db);

    // 1. Session document
    const sessionRef = doc(collection(db, 'users', uid, 'sessions'), session.id);
    batch.set(sessionRef, session);

    // 2. User profile
    const userRef = doc(db, 'users', uid);
    batch.update(userRef, {
        totalXp: newTotalXp,
        totalReps: increment(session.reps),
        totalSessions: increment(1),
        level: newLevel,
        exerciseXp: newExerciseXp,
        exerciseLevels: newExerciseLevels,
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
    if (session.exerciseType) feedEvent.exerciseType = session.exerciseType;
    if (session.isMultiExercise) {
        feedEvent.isMultiExercise = true;
        // Build lightweight per-block summaries for the feed
        if (session.blocks && session.sets) {
            let si = 0;
            const summaries: { label: string; reps: number }[] = [];
            for (const block of session.blocks) {
                const blockSets = session.sets.slice(si, si + block.numberOfSets);
                si += block.numberOfSets;
                const reps = blockSets.reduce((s, st) => s + st.reps, 0);
                const label = block.exerciseType === 'squat' ? 'Squats' : 'Push-ups';
                summaries.push({ label, reps });
            }
            feedEvent.blockSummaries = summaries;
        }
    }
    const feedRef = doc(collection(db, 'users', uid, 'activityFeed'));
    batch.set(feedRef, feedEvent);

    await batch.commit();

    // Prune feed events older than 30 days — fire-and-forget, never blocks the save
    const cutoff = Timestamp.fromMillis(Date.now() - FEED_PRUNE_AGE_MS);
    getDocs(query(
        collection(db, 'users', uid, 'activityFeed'),
        where('createdAt', '<', cutoff),
    )).then(snap => snap.forEach(d => { deleteDoc(d.ref); })).catch(() => { /* non-critical */ });
}

// ─── Merge local guest data into Firestore on first login ────────────────────

export interface MergeLocalDataParams {
    uid: string;
    localXp: number;
    localExerciseXp: Partial<Record<string, number>>;
    localSessions: SessionRecord[];
    cloudXp: number;
    cloudSessions: number;
    cloudExerciseXp: Partial<Record<string, number>>;
}

export async function mergeLocalDataToCloud({
    uid,
    localXp,
    localExerciseXp,
    localSessions,
    cloudXp,
    cloudSessions,
    cloudExerciseXp,
}: MergeLocalDataParams): Promise<void> {
    const batch = writeBatch(db);
    const userRef = doc(db, 'users', uid);

    const newTotalXp = cloudXp + localXp;
    const newLevel = levelFromTotalXp(newTotalXp);

    // Merge per-exercise XP
    const mergedExerciseXp: Record<string, number> = {};
    for (const [type, xp] of Object.entries(cloudExerciseXp)) {
        if (xp !== undefined) mergedExerciseXp[type] = xp;
    }
    for (const [type, xp] of Object.entries(localExerciseXp)) {
        mergedExerciseXp[type] = (mergedExerciseXp[type] ?? 0) + (xp ?? 0);
    }
    const mergedExerciseLevels: Record<string, number> = {};
    for (const [type, xp] of Object.entries(mergedExerciseXp)) {
        mergedExerciseLevels[type] = levelFromTotalXp(xp ?? 0);
    }

    // ── Compute streak from local sessions ─────────────────────────────────
    const profileUpdate: Record<string, unknown> = {
        totalXp: newTotalXp,
        totalSessions: cloudSessions + localSessions.length,
        level: newLevel,
        exerciseXp: mergedExerciseXp,
        exerciseLevels: mergedExerciseLevels,
    };

    if (localSessions.length > 0) {
        const todayLocal = localDateString();
        const yesterdayLocal = yesterdayDateString();

        // Sort sessions newest-first and get their local date strings
        const sortedDates = [...localSessions]
            .sort((a, b) => b.date - a.date)
            .map(s => localDateString(new Date(s.date)));

        const mostRecentDate = sortedDates[0];

        // Only grant streak if the most recent session was today or yesterday
        if (mostRecentDate === todayLocal || mostRecentDate === yesterdayLocal) {
            // Count consecutive unique days starting from mostRecentDate
            const uniqueDays = [...new Set(sortedDates)];
            let streak = 0;
            let expected = mostRecentDate;
            for (const day of uniqueDays) {
                if (day === expected) {
                    streak++;
                    const d = new Date(expected);
                    d.setDate(d.getDate() - 1);
                    expected = localDateString(d);
                } else {
                    break;
                }
            }
            profileUpdate.streak = streak;
            profileUpdate.lastSessionDate = mostRecentDate;
        }
    }

    batch.set(userRef, profileUpdate, { merge: true });

    localSessions.forEach(session => {
        const sessionRef = doc(collection(db, 'users', uid, 'sessions'), session.id);
        batch.set(sessionRef, session);
    });

    await batch.commit();
}
