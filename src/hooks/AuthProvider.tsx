import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@lib/firebase';
import { AuthContext } from './useAuth';
import type { DbUser } from './useAuth';
import { useLevelSystem } from './useLevelSystem';
import { useNotifications } from './useNotifications';

function AppServices({ children }: { children: React.ReactNode }) {
    // Mounted once at the top of the tree — single Firestore listener
    const levelSystem = useLevelSystem();
    useNotifications();

    return (
        <AuthContext.Consumer>
            {ctx => (
                <AuthContext.Provider value={{ ...ctx, ...levelSystem }}>
                    {children}
                </AuthContext.Provider>
            )}
        </AuthContext.Consumer>
    );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState(null as import('firebase/auth').User | null);
    const [dbUser, setDbUser] = useState<DbUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);
            if (firebaseUser) {
                try {
                    const docSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
                    if (docSnap.exists()) {
                        setDbUser(docSnap.data() as DbUser);
                    } else {
                        setDbUser(null);
                    }
                } catch (err) {
                    console.error('Error fetching user data:', err);
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
            console.error('Google sign in failed', error);
            throw error;
        }
    };

    const logout = async () => {
        await signOut(auth);
        localStorage.removeItem('pushup_game_total_reps');
        localStorage.removeItem('pushup-sessions');
        localStorage.removeItem('pushup_game_total_sessions');
        localStorage.removeItem('pushup_merge_in_progress');
    };

    // Provide base auth values; AppServices will merge level system values on top
    const baseValue = {
        user, dbUser, loading, loginWithGoogle, logout,
        // placeholders overridden by AppServices below
        level: 0,
        totalLifetimeReps: 0,
        repsIntoCurrentLevel: 0,
        repsNeededForNextLevel: 1,
        levelProgressPct: 0,
        addRepsToLifetime: async () => {},
    };

    return (
        <AuthContext.Provider value={baseValue}>
            <AppServices>
                {children}
            </AppServices>
        </AuthContext.Provider>
    );
}

