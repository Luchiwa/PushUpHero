import { createContext, useContext } from 'react';
import type { User } from 'firebase/auth';

export interface DbUser {
    uid: string;
    displayName: string;
    level: number;
    totalReps: number;
    createdAt?: number;
}

export interface AuthContextType {
    user: User | null;
    dbUser: DbUser | null;
    loading: boolean;
    loginWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function useAuth() {
    return useContext(AuthContext);
}

