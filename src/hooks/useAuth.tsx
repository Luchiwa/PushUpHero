/**
 * useAuth.tsx — Auth, Level, and Session contexts.
 *
 * Three separate contexts prevent unrelated re-renders:
 *   - AuthCoreContext: user, dbUser, loading, auth methods  → useAuthCore()
 *   - LevelContext:    XP, level, per-exercise XP, guest XP → useLevel()
 *   - SessionContext:  sessions list, session count          → useSessions()
 */
import { createContext, useContext } from 'react';
import type { ExerciseType, ExerciseXpMap, SessionRecord } from '@exercises/types';
import { createLevel, createXpAmount, type AppUser, type DbUser, type Level, type XpAmount } from '@domain';

// ── AuthContext (core auth only) ─────────────────────────────────

export interface AuthCoreContextType {
    user: AppUser | null;
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
    level: Level;
    totalXp: XpAmount;
    xpIntoCurrentLevel: number;
    xpNeededForNextLevel: number;
    levelProgressPct: number;
    exerciseXp: ExerciseXpMap;
    setExerciseXp: (map: ExerciseXpMap) => void;
    getExerciseLevel: (type: ExerciseType) => Level;
    getExerciseXp: (type: ExerciseType) => number;
    getExerciseLevelProgress: (type: ExerciseType) => {
        level: Level;
        xp: XpAmount;
        xpIntoLevel: number;
        xpNeeded: number;
        progressPct: number;
    };
    addGuestXp: (globalXp: number, perExercise: { exerciseType: ExerciseType; xp: number }[]) => void;
    setTotalXp: (xp: XpAmount) => void;
}

const LEVEL_DEFAULT: LevelContextType = {
    level: createLevel(0),
    totalXp: createXpAmount(0),
    xpIntoCurrentLevel: 0,
    xpNeededForNextLevel: 1,
    levelProgressPct: 0,
    exerciseXp: {},
    setExerciseXp: () => {},
    getExerciseLevel: () => createLevel(0),
    getExerciseXp: () => 0,
    getExerciseLevelProgress: () => ({
        level: createLevel(0),
        xp: createXpAmount(0),
        xpIntoLevel: 0,
        xpNeeded: 1,
        progressPct: 0,
    }),
    addGuestXp: () => {},
    setTotalXp: () => {},
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

