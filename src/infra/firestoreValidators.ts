/**
 * firestoreValidators — Runtime type guards for Firestore documents.
 *
 * Repositories MUST validate documents through these guards before casting.
 * A malformed doc is filtered out (with `console.warn`) rather than propagated
 * to the UI layer where it would crash silently.
 *
 * Pure type guards — zero external deps. Only checks fields that the rest of
 * the codebase treats as *required*; optional fields pass through untouched.
 */

import { Timestamp } from 'firebase/firestore';
import { EXERCISE_TYPES, type ExerciseType, type ExerciseXpMap, type SessionRecord } from '@exercises/types';
import { createUserId, type BodyProfile, type QuestProgress, type RecordsMap, type UserId } from '@domain';
import type { FriendRequest } from '@services/friendService';

const isObj = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null;

const isKnownExerciseType = (v: unknown): v is ExerciseType =>
    typeof v === 'string' && (EXERCISE_TYPES as readonly string[]).includes(v);

// ── Timestamp coercion ───────────────────────────────────────────────────────

/**
 * Coerces a Firestore field that may be a `Timestamp`, a number (Unix ms),
 * or undefined/null into a number. The repo layer uses this to keep
 * Firebase types from leaking past the boundary.
 */
export function tsToMs(v: unknown, fallback = 0): number {
    if (v instanceof Timestamp) return v.toMillis();
    if (typeof v === 'number') return v;
    return fallback;
}

// ── Persisted user doc (Firestore wire format, flat) ────────────────────────

/**
 * The flat shape Firestore actually stores. Mirrors the legacy `DbUser`
 * before PUS-16. Repositories validate with `isFlatUserDoc`, then unfold
 * into the nested domain `DbUser` via `unfoldDbUser` in `userRepository`.
 */
export interface FlatUserDoc {
    uid: string;
    displayName: string;
    level: number;
    totalXp: number;
    /** @deprecated Legacy field — use totalXp */
    totalReps?: number;
    createdAt?: number;
    photoURL?: string;
    photoThumb?: string;
    streak?: number;
    lastSessionDate?: string;
    totalSessions?: number;
    exerciseXp?: ExerciseXpMap;
    exerciseLevels?: Partial<Record<ExerciseType, number>>;
    bestStreak?: number;
    totalEncouragementsSent?: number;
    sGradeCount?: number;
    lifetimeReps?: Partial<Record<ExerciseType, number>>;
    lifetimeTrainingTime?: number;
    achievements?: Record<string, number>;
    records?: RecordsMap;
    bodyProfile?: BodyProfile;
    questProgress?: QuestProgress;
    /** Persisted UI language preference (e.g. `'fr'`, `'en'`). */
    preferredLanguage?: string;
}

// ── Required-field guards ────────────────────────────────────────────────────

export function isFlatUserDoc(v: unknown): v is FlatUserDoc {
    return isObj(v)
        && typeof v.uid === 'string'
        && typeof v.displayName === 'string'
        && typeof v.level === 'number'
        && typeof v.totalXp === 'number';
}

export function isSessionRecord(v: unknown): v is SessionRecord {
    return isObj(v)
        && typeof v.id === 'string'
        && typeof v.date === 'number'
        && typeof v.reps === 'number'
        && typeof v.averageScore === 'number'
        && typeof v.goalReps === 'number';
}

export function isFriendRequest(v: unknown): v is FriendRequest {
    return isObj(v)
        && typeof v.fromUid === 'string'
        && typeof v.fromUsername === 'string'
        && v.status === 'pending'
        && typeof v.sentAt === 'number';
}

// ── Parsed event types (read-side only) ──────────────────────────────────────

/**
 * Parsed notification — the shape repos hand back to consumers, with timestamps
 * already coerced to ms. Decoupled from the Firestore doc structure.
 */
export interface NotificationEvent {
    id: string;
    type: string;
    fromUid: UserId;
    fromUsername: string;
    sentAtMs: number;
}

export function parseNotification(id: string, data: unknown): NotificationEvent | null {
    if (!isObj(data)) return null;
    if (typeof data.type !== 'string' || typeof data.fromUid !== 'string' || !data.fromUid) return null;
    return {
        id,
        type: data.type,
        fromUid: createUserId(data.fromUid),
        fromUsername: typeof data.fromUsername === 'string' ? data.fromUsername : '',
        sentAtMs: tsToMs(data.sentAt),
    };
}

/**
 * Parsed activity feed event — domain-shaped data the repo extracts from a raw
 * Firestore activity doc. The repo joins this with friend metadata at the
 * consumer site, so display fields (uid, displayName, photoURL) are absent here.
 */
export interface ActivityFeedDoc {
    id: string;
    createdAtMs: number;
    type: 'session';
    reps: number;
    averageScore: number;
    sessionMode: 'reps' | 'time';
    goalReps: number;
    elapsedTime?: number;
    numberOfSets?: number;
    exerciseType?: ExerciseType;
    isMultiExercise?: boolean;
    /**
     * Per-block summaries for multi-exercise feed events. New writers persist
     * `exerciseType` (translated at render). Legacy docs persisted `label`
     * (writer-locale text); the consumer falls back to it for back-compat.
     */
    blockSummaries?: { exerciseType?: ExerciseType; label?: string; reps: number }[];
}

export function parseActivityFeedDoc(id: string, data: unknown): ActivityFeedDoc | null {
    if (!isObj(data)) return null;
    if (data.type !== 'session') return null;
    return {
        id,
        createdAtMs: tsToMs(data.createdAt, Date.now()),
        type: 'session',
        reps: typeof data.reps === 'number' ? data.reps : 0,
        averageScore: typeof data.averageScore === 'number' ? data.averageScore : 0,
        sessionMode: data.sessionMode === 'time' ? 'time' : 'reps',
        goalReps: typeof data.goalReps === 'number' ? data.goalReps : 0,
        elapsedTime: typeof data.elapsedTime === 'number' ? data.elapsedTime : undefined,
        numberOfSets: typeof data.numberOfSets === 'number' ? data.numberOfSets : undefined,
        exerciseType: isKnownExerciseType(data.exerciseType) ? data.exerciseType : undefined,
        isMultiExercise: typeof data.isMultiExercise === 'boolean' ? data.isMultiExercise : undefined,
        blockSummaries: Array.isArray(data.blockSummaries)
            ? data.blockSummaries
                .filter((b): b is Record<string, unknown> => isObj(b) && typeof b.reps === 'number')
                .map(b => ({
                    exerciseType: isKnownExerciseType(b.exerciseType) ? b.exerciseType : undefined,
                    label: typeof b.label === 'string' ? b.label : undefined,
                    reps: b.reps as number,
                }))
                .filter(b => b.exerciseType !== undefined || b.label !== undefined)
            : undefined,
    };
}
