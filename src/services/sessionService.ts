/**
 * sessionService.ts
 *
 * Saves a completed workout session atomically:
 * session doc + profile update + activity feed + achievements + records.
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
} from 'firebase/firestore';
import { db } from '@infra/firebase';
import { userRef, sessionRef, activityFeedCol } from '@infra/refs';
import { FEED_PRUNE_AGE_MS, buildSessionRepsMap, createXpAmount, emptyRecords, evaluateAchievements, evaluateRecords, getGradeLetter, levelFromTotalXp, type AchievementDef, type AchievementMap, type DbUser, type RecordUpdate, type RecordsMap, type UserId, type UserStats, type XpAmount } from '@domain';
import type { SessionRecord } from '@exercises/types';
import type { ExerciseType } from '@exercises/types';
import { getExerciseLabel } from '@exercises/types';

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
    const lastDate = dbUser?.stats.lastSessionDate;
    if (lastDate === todayLocal) return dbUser?.stats.streak ?? 1;
    if (lastDate === yesterdayDateString()) return (dbUser?.stats.streak ?? 0) + 1;
    return 1;
}

// ─── Core write: save a completed session ────────────────────────────────────

export interface SaveSessionParams {
    uid: UserId;
    session: SessionRecord;
    /** Lifetime total XP BEFORE this session */
    currentTotalXp: XpAmount;
    /** XP earned this session (after bonuses) */
    sessionXp: XpAmount;
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
    const newTotalXp = createXpAmount(currentTotalXp + sessionXp);
    const newLevel = levelFromTotalXp(newTotalXp);
    const newStreak = computeNewStreak(dbUser, todayLocal);
    const newBestStreak = Math.max(dbUser?.stats.bestStreak ?? 0, newStreak);

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
        newExerciseLevels[type] = levelFromTotalXp(createXpAmount(xp ?? 0));
    }

    // ── Lifetime reps per exercise (for achievements) ────────────────────
    const sessionRepsMap = buildSessionRepsMap(session);

    const prevLifetimeReps = dbUser?.progression.lifetimeReps ?? {};
    const newLifetimeReps: Partial<Record<ExerciseType, number>> = { ...prevLifetimeReps };
    for (const [ex, reps] of Object.entries(sessionRepsMap)) {
        newLifetimeReps[ex as ExerciseType] = (newLifetimeReps[ex as ExerciseType] ?? 0) + reps;
    }

    // ── S-grade tracking ─────────────────────────────────────────────────
    const isS = getGradeLetter(session.averageScore) === 'S';
    const newSGradeCount = (dbUser?.stats.sGradeCount ?? 0) + (isS ? 1 : 0);
    const newTotalSessions = currentTotalSessions + 1;

    // ── Cumulative training time ─────────────────────────────────────────
    const sessionDuration = session.totalDuration ?? session.elapsedTime ?? 0;
    const newLifetimeTrainingTime = (dbUser?.stats.lifetimeTrainingTime ?? 0) + sessionDuration;

    // ── Evaluate achievements ────────────────────────────────────────────
    const currentAchievements: AchievementMap = { ...(dbUser?.achievements ?? {}) };
    const stats: UserStats = {
        lifetimeRepsByExercise: newLifetimeReps,
        sessionRepsByExercise: sessionRepsMap,
        totalSessions: newTotalSessions,
        bestStreak: newBestStreak,
        friendsCount,
        totalEncouragementsSent: dbUser?.stats.totalEncouragementsSent ?? 0,
        sGradeCount: newSGradeCount,
        sessionXp: session.xpEarned ?? 0,
        globalLevel: newLevel,
        lifetimeTrainingTime: newLifetimeTrainingTime,
        sessionDuration,
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
