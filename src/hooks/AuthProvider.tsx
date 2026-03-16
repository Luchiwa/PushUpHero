import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '@lib/firebase';
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
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            setUser(firebaseUser);
            if (firebaseUser) {
                // Realtime listener on the user profile — keeps dbUser (streak, level, etc.) always fresh
                const userRef = doc(db, 'users', firebaseUser.uid);
                const unsubUser = onSnapshot(userRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const userData = docSnap.data() as DbUser;

                        // Reset streak if no session was made yesterday or today (local calendar days)
                        if (userData.lastSessionDate && (userData.streak ?? 0) > 0) {
                            const now = new Date();
                            const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                            const yesterday = new Date(now);
                            yesterday.setDate(yesterday.getDate() - 1);
                            const yesterdayLocal = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

                            const isRecentEnough = userData.lastSessionDate === todayLocal || userData.lastSessionDate === yesterdayLocal;
                            if (!isRecentEnough) {
                                userData.streak = 0;
                                updateDoc(userRef, { streak: 0 }).catch(() => {});
                            }
                        }

                        setDbUser(userData);
                    } else {
                        setDbUser(null);
                    }
                    setLoading(false);
                });
                return unsubUser;
            } else {
                setDbUser(null);
                setLoading(false);
                return undefined;
            }
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

    const uploadAvatar = async (file: File) => {
        if (!user) throw new Error('Not authenticated');
        // Resize to max 512px before upload to save bandwidth
        const bitmap = await createImageBitmap(file);
        const size = Math.min(512, bitmap.width, bitmap.height);
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        // Center-crop square
        const srcSize = Math.min(bitmap.width, bitmap.height);
        const sx = (bitmap.width - srcSize) / 2;
        const sy = (bitmap.height - srcSize) / 2;
        ctx.drawImage(bitmap, sx, sy, srcSize, srcSize, 0, 0, size, size);
        const blob = await new Promise<Blob>((resolve) =>
            canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.85)
        );
        const storageRef = ref(storage, `avatars/${user.uid}.jpg`);
        await user.getIdToken(true); // force token refresh
        await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
        const url = await getDownloadURL(storageRef);
        await updateDoc(doc(db, 'users', user.uid), { photoURL: url });
        setDbUser(prev => prev ? { ...prev, photoURL: url } : prev);
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
        user, dbUser, loading, loginWithGoogle, logout, uploadAvatar,
        // placeholders overridden by AppServices below
        level: 0,
        totalLifetimeReps: 0,
        repsIntoCurrentLevel: 0,
        repsNeededForNextLevel: 1,
        levelProgressPct: 0,
        addGuestReps: () => {},
    };

    return (
        <AuthContext.Provider value={baseValue}>
            <AppServices>
                {children}
            </AppServices>
        </AuthContext.Provider>
    );
}

