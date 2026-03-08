import { useState, useEffect, createContext, useContext } from 'react';
import { onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface AuthContextType {
    user: User | null;
    dbUser: DbUser | null;
    loading: boolean;
    loginWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
}

export interface DbUser {
    uid: string;
    displayName: string;
    level: number;
    totalReps: number;
    createdAt?: number; // timestamp
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [dbUser, setDbUser] = useState<DbUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);
            if (firebaseUser) {
                // Fetch the custom user document if it exists
                try {
                    const docSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
                    if (docSnap.exists()) {
                        setDbUser(docSnap.data() as DbUser);
                    } else {
                        setDbUser(null);
                    }
                } catch (err) {
                    console.error("Error fetching user data:", err);
                    setDbUser(null);
                }
            } else {
                setDbUser(null);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const loginWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Google sign in failed", error);
            throw error;
        }
    };

    const logout = async () => {
        await signOut(auth);
    };

    return (
        <AuthContext.Provider value={{ user, dbUser, loading, loginWithGoogle, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
