/**
 * userService.ts
 *
 * Pure Firestore write functions — no React, no hooks, no state.
 * All user-data mutations go through here so they're easy to find,
 * test, and extend (e.g. new session fields, XP multipliers, achievements…).
 */

import {
    doc,
    writeBatch,
    increment,
    serverTimestamp,
    getDocs,
    query,
    where,
    Timestamp,
    deleteDoc,
    updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { userRef, sessionRef, activityFeedCol } from './refs';
import { FEED_PRUNE_AGE_MS, getGradeLetter } from './constants';
import { levelFromTotalXp } from '@lib/xpSystem';
import type { SessionRecord } from '@exercises/types';
import type { DbUser } from './authTypes';
import type { ExerciseType } from '@exercises/types';
import { getExerciseLabel } from '@exercises/types';
import { evaluateAchievements, evaluateRecords, emptyRecords, computeLifetimeReps, countSGrades, bulkEvaluateRecords } from './achievementEngine';
import type { UserStats, AchievementMap, RecordsMap, RecordUpdate } from './achievementEngine';
import type { AchievementDef } from './achievements';
import type { GuestStatsSnapshot } from './guestStatsStore';

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
    /** All sessions (including the new one) for records evaluation */
    allSessions: SessionRecord[];
    /** Current friend count (for social achievements) */
    friendsCount: number;
    /** Current total session count BEFORE this session */
    currentTotalSessions: number;
}

export interface SaveSessionResult {
    newAchievements: AchievementDef[];
    brokenRecords: RecordUpdate[];
}

/**
 * Atomically writes in one batch:
 *   1. The session document
 *   2. totalXp increment + level + exerciseXp + exerciseLevels + streak + lastSessionDate
 *   3. An activity feed event
 *   4. Achievement unlocks + record updates
 *
 * Fire-and-forget pruning of old feed events runs after the batch.
 *
 * @returns Newly unlocked achievements and broken records (for toast/summary display)
 */
export async function saveSession({
    uid, session, currentTotalXp, sessionXp, exerciseXpDeltas, currentExerciseXp, dbUser,
    allSessions, friendsCount, currentTotalSessions,
}: SaveSessionParams): Promise<SaveSessionResult> {
    const todayLocal = localDateString();
    const newTotalXp = currentTotalXp + sessionXp;
    const newLevel = levelFromTotalXp(newTotalXp);
    const newStreak = computeNewStreak(dbUser, todayLocal);
    const newBestStreak = Math.max(dbUser?.bestStreak ?? 0, newStreak);

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

    // ── Lifetime reps per exercise (for achievements) ────────────────────
    const exerciseType = (session.exerciseType ?? 'pushup') as ExerciseType;
    const sessionRepsMap: Partial<Record<ExerciseType, number>> = {};
    if (session.sets && session.sets.length > 0) {
        for (const set of session.sets) {
            const ex = (set.exerciseType ?? exerciseType) as ExerciseType;
            sessionRepsMap[ex] = (sessionRepsMap[ex] ?? 0) + set.reps;
        }
    } else {
        sessionRepsMap[exerciseType] = session.reps;
    }

    const prevLifetimeReps = dbUser?.lifetimeReps ?? {};
    const newLifetimeReps: Partial<Record<ExerciseType, number>> = { ...prevLifetimeReps };
    for (const [ex, reps] of Object.entries(sessionRepsMap)) {
        newLifetimeReps[ex as ExerciseType] = (newLifetimeReps[ex as ExerciseType] ?? 0) + reps;
    }

    // ── S-grade tracking ─────────────────────────────────────────────────
    const isS = getGradeLetter(session.averageScore) === 'S';
    const newSGradeCount = (dbUser?.sGradeCount ?? 0) + (isS ? 1 : 0);
    const newTotalSessions = currentTotalSessions + 1;

    // ── Cumulative training time ─────────────────────────────────────────
    const sessionDuration = session.totalDuration ?? session.elapsedTime ?? 0;
    const newLifetimeTrainingTime = (dbUser?.lifetimeTrainingTime ?? 0) + sessionDuration;

    // ── Evaluate achievements ────────────────────────────────────────────
    const currentAchievements: AchievementMap = { ...(dbUser?.achievements ?? {}) };
    const stats: UserStats = {
        lifetimeRepsByExercise: newLifetimeReps,
        sessionRepsByExercise: sessionRepsMap,
        totalSessions: newTotalSessions,
        bestStreak: newBestStreak,
        friendsCount,
        totalEncouragementsSent: dbUser?.totalEncouragementsSent ?? 0,
        sGradeCount: newSGradeCount,
        sessionXp: session.xpEarned ?? 0,
        globalLevel: newLevel,
        lifetimeTrainingTime: newLifetimeTrainingTime,
    };
    const newAchievements = evaluateAchievements(stats, currentAchievements);

    // ── Evaluate records ─────────────────────────────────────────────────
    const currentRecords: RecordsMap = dbUser?.records ?? emptyRecords();
    const { records: updatedRecords, broken: brokenRecords } = evaluateRecords(
        currentRecords, session, allSessions, newBestStreak,
    );

    // ── Firestore batch ──────────────────────────────────────────────────

    const batch = writeBatch(db);

    // 1. Session document
    batch.set(sessionRef(uid, session.id), session);

    // 2. User profile
    batch.update(userRef(uid), {
        totalXp: newTotalXp,
        totalReps: increment(session.reps),
        totalSessions: increment(1),
        level: newLevel,
        exerciseXp: newExerciseXp,
        exerciseLevels: newExerciseLevels,
        streak: newStreak,
        lastSessionDate: todayLocal,
        // New achievement-related fields
        bestStreak: newBestStreak,
        sGradeCount: newSGradeCount,
        lifetimeReps: newLifetimeReps,
        lifetimeTrainingTime: newLifetimeTrainingTime,
        achievements: currentAchievements,   // includes newly unlocked
        records: updatedRecords,
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
                const label = getExerciseLabel(block.exerciseType);
                summaries.push({ label, reps });
            }
            feedEvent.blockSummaries = summaries;
        }
    }
    batch.set(doc(activityFeedCol(uid)), feedEvent);

    await batch.commit();

    // Prune feed events older than 30 days — fire-and-forget, never blocks the save
    const cutoff = Timestamp.fromMillis(Date.now() - FEED_PRUNE_AGE_MS);
    getDocs(query(
        activityFeedCol(uid),
        where('createdAt', '<', cutoff),
    )).then(snap => snap.forEach(d => { deleteDoc(d.ref); })).catch(() => { /* non-critical */ });

    return { newAchievements, brokenRecords };
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
    /** Guest achievement stats accumulated while playing without an account */
    guestStats?: GuestStatsSnapshot;
}

export async function mergeLocalDataToCloud({
    uid,
    localXp,
    localExerciseXp,
    localSessions,
    cloudXp,
    cloudSessions,
    cloudExerciseXp,
    guestStats,
}: MergeLocalDataParams): Promise<void> {
    const batch = writeBatch(db);

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
            profileUpdate.bestStreak = streak;
            profileUpdate.lastSessionDate = mostRecentDate;
        }
    }

    // ── Bulk-evaluate achievements & records from merged sessions ────────
    const newTotalSessions = cloudSessions + localSessions.length;
    const lifetimeReps = computeLifetimeReps(localSessions);
    const sGradeCount = countSGrades(localSessions);
    const bestStreak = (profileUpdate.bestStreak as number) ?? 0;

    // Find max XP earned in any single session
    let maxSessionXp = 0;
    for (const s of localSessions) {
        if ((s.xpEarned ?? 0) > maxSessionXp) maxSessionXp = s.xpEarned ?? 0;
    }

    // Compute total training time from local sessions
    const totalTrainingTime = localSessions.reduce(
        (sum, s) => sum + (s.totalDuration ?? s.elapsedTime ?? 0), 0,
    );

    // Seed achievement map with guest-tracked achievements (keeps earliest unlock timestamp)
    const achievementMap: AchievementMap = {};
    if (guestStats?.achievements) {
        for (const [id, ts] of Object.entries(guestStats.achievements)) {
            achievementMap[id] = ts;
        }
    }

    const stats: UserStats = {
        lifetimeRepsByExercise: lifetimeReps,
        sessionRepsByExercise: {}, // Will check per-session below
        totalSessions: newTotalSessions,
        bestStreak,
        friendsCount: 0, // No friends context during merge
        totalEncouragementsSent: 0,
        sGradeCount,
        sessionXp: maxSessionXp,
        globalLevel: newLevel,
        lifetimeTrainingTime: totalTrainingTime,
    };

    // Check single-session achievements by finding max reps per exercise across all sessions
    for (const s of localSessions) {
        const ex = (s.exerciseType ?? 'pushup') as ExerciseType;
        const currentMax = stats.sessionRepsByExercise[ex] ?? 0;
        if (s.reps > currentMax) {
            stats.sessionRepsByExercise[ex] = s.reps;
        }
    }

    evaluateAchievements(stats, achievementMap);

    // Seed records from guest stats, then bulk-evaluate from sessions on top
    const guestRecords = guestStats?.records ?? emptyRecords();
    const records = bulkEvaluateRecords(localSessions, bestStreak, guestRecords);

    profileUpdate.lifetimeReps = lifetimeReps;
    profileUpdate.sGradeCount = sGradeCount;
    profileUpdate.lifetimeTrainingTime = totalTrainingTime;
    profileUpdate.achievements = achievementMap;
    profileUpdate.records = records;

    batch.set(userRef(uid), profileUpdate, { merge: true });

    localSessions.forEach(session => {
        batch.set(sessionRef(uid, session.id), session);
    });

    await batch.commit();
}

// ─── Live achievement check ──────────────────────────────────────────────────
// Some achievements (social: friends count, encouragements) depend on state that
// changes outside of sessions. This function evaluates them and persists any
// newly unlocked achievements to Firestore without requiring a session save.

export async function checkLiveAchievements(
    uid: string,
    stats: UserStats,
    currentAchievements: AchievementMap,
): Promise<AchievementDef[]> {
    const newlyUnlocked = evaluateAchievements(stats, currentAchievements);
    if (newlyUnlocked.length === 0) return [];

    // currentAchievements was mutated in-place by evaluateAchievements (timestamps added)
    await updateDoc(userRef(uid), { achievements: currentAchievements });

    return newlyUnlocked;
}

// ─── Field-level user updates ───────────────────────────────────────────────
// Thin wrappers so hooks never import firebase/firestore directly.

import type { BodyProfile } from '@lib/bodyProfile';
import type { QuestProgress } from '@lib/quests';

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
