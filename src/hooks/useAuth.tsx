import { createContext, useContext } from 'react';
import type { User } from 'firebase/auth';

export interface DbUser {
    uid: string;
    displayName: string;
    level: number;
    totalReps: number;
    createdAt?: number;
    photoURL?: string;
    streak?: number;
    lastSessionDate?: string; // UTC date string YYYY-MM-DD
}

export interface AuthContextType {
    user: User | null;
    dbUser: DbUser | null;
    loading: boolean;
    loginWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
    uploadAvatar: (file: File) => Promise<void>;
    // Level system
    level: number;
    totalLifetimeReps: number;
    repsIntoCurrentLevel: number;
    repsNeededForNextLevel: number;
    levelProgressPct: number;
    addRepsToLifetime: (reps: number) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function useAuth() {
    return useContext(AuthContext);
}

