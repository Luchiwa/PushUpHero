import { createContext, useContext } from 'react';
import type { User } from 'firebase/auth';
import type { SessionRecord } from './useSessionHistory';
import type { ExerciseType } from '@exercises/types';

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
}

export interface AuthContextType {
    user: User | null;
    dbUser: DbUser | null;
    loading: boolean;
    loginWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
    uploadAvatar: (file: File) => Promise<void>;
    // XP-based level system
    level: number;
    totalXp: number;
    xpIntoCurrentLevel: number;
    xpNeededForNextLevel: number;
    levelProgressPct: number;
    // Per-exercise XP
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
    // Guest XP
    addGuestXp: (globalXp: number, perExercise: { exerciseType: ExerciseType; xp: number }[]) => void;
    // Backward-compat aliases
    /** @deprecated Use totalXp */
    totalLifetimeReps: number;
    setTotalLifetimeReps: (xp: number) => void;
    setTotalXp: (xp: number) => void;
    addGuestReps: (reps: number) => void;
    repsIntoCurrentLevel: number;
    repsNeededForNextLevel: number;
    // Sessions (synced from Firestore via useSyncCloud)
    sessions: SessionRecord[];
    setSessions: (sessions: SessionRecord[]) => void;
    totalSessionCount: number;
    setTotalSessionCount: (count: number) => void;
}

export const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function useAuth() {
    return useContext(AuthContext);
}

