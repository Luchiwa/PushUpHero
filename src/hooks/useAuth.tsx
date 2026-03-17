import { createContext, useContext } from 'react';
import type { User } from 'firebase/auth';
import type { SessionRecord } from './useSessionHistory';

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
    addGuestReps: (reps: number) => void;
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

