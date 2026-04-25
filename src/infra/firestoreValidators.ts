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
import type { DbUser } from '@domain/authTypes';
import type { SessionRecord, ExerciseType } from '@exercises/types';
import { EXERCISE_TYPES } from '@exercises/types';
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

// ── Required-field guards ────────────────────────────────────────────────────

export function isDbUser(v: unknown): v is DbUser {
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
    fromUid: string;
    fromUsername: string;
    sentAtMs: number;
}

export function parseNotification(id: string, data: unknown): NotificationEvent | null {
    if (!isObj(data)) return null;
    if (typeof data.type !== 'string' || typeof data.fromUid !== 'string') return null;
    return {
        id,
        type: data.type,
        fromUid: data.fromUid,
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
    blockSummaries?: { label: string; reps: number }[];
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
            ? data.blockSummaries.filter((b): b is { label: string; reps: number } =>
                isObj(b) && typeof b.label === 'string' && typeof b.reps === 'number')
            : undefined,
    };
}
