/**
 * useAuth.tsx — Auth, Level, and Session contexts.
 *
 * Three separate contexts prevent unrelated re-renders:
 *   - AuthContext:    user, dbUser, loading, auth methods
 *   - LevelContext:   XP, level, per-exercise XP, guest XP
 *   - SessionContext: sessions list, session count
 *
 * useAuth() is a backward-compatible facade that merges all three.
 * Prefer the granular hooks (useAuthCore, useLevel, useSessions) in new code
 * to subscribe only to the data you need.
 */
import { createContext, useContext } from 'react';
import type { User } from 'firebase/auth';
import type { SessionRecord } from './useSessionHistory';
import type { ExerciseType } from '@exercises/types';
import type { BodyProfile } from '@lib/bodyProfile';
import type { QuestProgress } from '@lib/quests';

export type ExerciseXpMap = Partial<Record<ExerciseType, number>>;

export interface DbUser {
    uid: string;
    displayName: string;
    level: number;
    totalXp: number;
    /** @deprecated Legacy field — use totalXp */
    totalReps?: number;
    createdAt?: number;
    photoURL?: string;
    streak?: number;
    lastSessionDate?: string; // UTC date string YYYY-MM-DD
    exerciseXp?: ExerciseXpMap;
    exerciseLevels?: Partial<Record<ExerciseType, number>>;

    // ── Achievements & Records ───────────────────────────────────────────
    bestStreak?: number;
    totalEncouragementsSent?: number;
    sGradeCount?: number;
    /** Lifetime reps per exercise (for achievement tracking) */
    lifetimeReps?: Partial<Record<ExerciseType, number>>;
    /** Cumulative training time in seconds (for achievements) */
    lifetimeTrainingTime?: number;
    /** Map of achievementId → unlock timestamp (millis) */
    achievements?: Record<string, number>;
    /** Personal records */
    records?: import('@lib/achievementEngine').RecordsMap;
    /** Body profile morphological ratios (captured during quests) */
    bodyProfile?: BodyProfile;
    /** Quest progress state */
    questProgress?: QuestProgress;
}

// ── AuthContext (core auth only) ─────────────────────────────────

export interface AuthCoreContextType {
    user: User | null;
    dbUser: DbUser | null;
    loading: boolean;
    loginWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
    uploadAvatar: (file: File) => Promise<void>;
}

const AUTH_CORE_DEFAULT: AuthCoreContextType = {
    user: null,
    dbUser: null,
    loading: true,
    loginWithGoogle: async () => {},
    logout: async () => {},
    uploadAvatar: async () => {},
};

export const AuthCoreContext = createContext<AuthCoreContextType>(AUTH_CORE_DEFAULT);

/** Core auth only: user, dbUser, loading, login/logout/uploadAvatar */
export function useAuthCore() {
    return useContext(AuthCoreContext);
}

// ── LevelContext (XP & level system) ─────────────────────────────

export interface LevelContextType {
    level: number;
    totalXp: number;
    xpIntoCurrentLevel: number;
    xpNeededForNextLevel: number;
    levelProgressPct: number;
    exerciseXp: ExerciseXpMap;
    setExerciseXp: (map: ExerciseXpMap) => void;
    getExerciseLevel: (type: ExerciseType) => number;
    getExerciseXp: (type: ExerciseType) => number;
    getExerciseLevelProgress: (type: ExerciseType) => {
        level: number;
        xp: number;
        xpIntoLevel: number;
        xpNeeded: number;
        progressPct: number;
    };
    addGuestXp: (globalXp: number, perExercise: { exerciseType: ExerciseType; xp: number }[]) => void;
    // Backward-compat aliases
    /** @deprecated Use totalXp */
    totalLifetimeReps: number;
    setTotalLifetimeReps: (xp: number) => void;
    setTotalXp: (xp: number) => void;
    addGuestReps: (reps: number) => void;
    repsIntoCurrentLevel: number;
    repsNeededForNextLevel: number;
}

const LEVEL_DEFAULT: LevelContextType = {
    level: 0,
    totalXp: 0,
    xpIntoCurrentLevel: 0,
    xpNeededForNextLevel: 1,
    levelProgressPct: 0,
    exerciseXp: {},
    setExerciseXp: () => {},
    getExerciseLevel: () => 0,
    getExerciseXp: () => 0,
    getExerciseLevelProgress: () => ({ level: 0, xp: 0, xpIntoLevel: 0, xpNeeded: 1, progressPct: 0 }),
    addGuestXp: () => {},
    totalLifetimeReps: 0,
    setTotalLifetimeReps: () => {},
    setTotalXp: () => {},
    addGuestReps: () => {},
    repsIntoCurrentLevel: 0,
    repsNeededForNextLevel: 1,
};

export const LevelContext = createContext<LevelContextType>(LEVEL_DEFAULT);

/** XP, level, per-exercise progress, guest XP */
export function useLevel() {
    return useContext(LevelContext);
}

// ── SessionContext ───────────────────────────────────────────────

export interface SessionContextType {
    sessions: SessionRecord[];
    setSessions: (sessions: SessionRecord[]) => void;
    totalSessionCount: number;
    setTotalSessionCount: (count: number) => void;
}

const SESSION_DEFAULT: SessionContextType = {
    sessions: [],
    setSessions: () => {},
    totalSessionCount: 0,
    setTotalSessionCount: () => {},
};

export const SessionContext = createContext<SessionContextType>(SESSION_DEFAULT);

/** Session list and count */
export function useSessions() {
    return useContext(SessionContext);
}

// ── Backward-compatible merged type & hook ───────────────────────

export type AuthContextType = AuthCoreContextType & LevelContextType & SessionContextType;

/**
 * @deprecated Prefer useAuthCore(), useLevel(), or useSessions() for granular subscriptions.
 * useAuth() merges all three contexts — any change in any context triggers a re-render.
 */
export function useAuth(): AuthContextType {
    const authCore = useContext(AuthCoreContext);
    const level = useContext(LevelContext);
    const session = useContext(SessionContext);
    return { ...authCore, ...level, ...session };
}
