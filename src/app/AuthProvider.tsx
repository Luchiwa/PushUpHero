import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '@lib/firebase';
import { AuthContext } from '@hooks/useAuth';
import type { DbUser } from '@hooks/useAuth';
import { useLevelSystem } from '@hooks/useLevelSystem';
import { useNotifications } from '@hooks/useNotifications';
import { useSyncCloud } from '@hooks/useSyncCloud';
import { invalidateAvatarCache } from '@hooks/useAvatarCache';
import type { SessionRecord } from '@hooks/useSessionHistory';

function AppServices({ children }: { children: React.ReactNode }) {
    // Mounted once at the top of the tree — single Firestore listener set
    const levelSystem = useLevelSystem();
    useNotifications();

    // Sessions state — synced from Firestore by the single useSyncCloud instance below
    const [sessions, setSessions] = useState<SessionRecord[]>([]);
    const [totalSessionCount, setTotalSessionCount] = useState<number>(0);

    // SINGLE useSyncCloud instance for the entire app
    useSyncCloud(levelSystem.setTotalXp, levelSystem.setExerciseXp, setSessions, setTotalSessionCount);

    return (
        <AuthContext.Consumer>
            {ctx => (
                <AuthContext.Provider value={{
                    ...ctx,
                    ...levelSystem,
                    sessions,
                    setSessions,
                    totalSessionCount,
                    setTotalSessionCount,
                }}>
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
                        // Streak reset is handled server-side by the resetExpiredStreaks Cloud Function (daily at 03:00 UTC)
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
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context unavailable');
        // Center-crop square
        const srcSize = Math.min(bitmap.width, bitmap.height);
        const sx = (bitmap.width - srcSize) / 2;
        const sy = (bitmap.height - srcSize) / 2;
        ctx.drawImage(bitmap, sx, sy, srcSize, srcSize, 0, 0, size, size);
        const blob = await new Promise<Blob>((resolve, reject) =>
            canvas.toBlob((b) => { if (b) resolve(b); else reject(new Error('toBlob failed')); }, 'image/jpeg', 0.85)
        );
        const storageRef = ref(storage, `avatars/${user.uid}.jpg`);
        await user.getIdToken(true); // force token refresh
        await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
        const url = await getDownloadURL(storageRef);
        // Bust the avatar cache so the new image is fetched fresh
        if (dbUser?.photoURL) await invalidateAvatarCache(dbUser.photoURL);
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

    // Provide base auth values; AppServices will merge level system + sessions on top
    const baseValue = {
        user, dbUser, loading, loginWithGoogle, logout, uploadAvatar,
        // placeholders overridden by AppServices below
        level: 0,
        totalXp: 0,
        xpIntoCurrentLevel: 0,
        xpNeededForNextLevel: 1,
        levelProgressPct: 0,
        exerciseXp: {} as import('@hooks/useAuth').ExerciseXpMap,
        setExerciseXp: () => {},
        getExerciseLevel: () => 0,
        getExerciseXp: () => 0,
        getExerciseLevelProgress: () => ({ level: 0, xp: 0, xpIntoLevel: 0, xpNeeded: 1, progressPct: 0 }),
        addGuestXp: () => {},
        // Backward-compat
        totalLifetimeReps: 0,
        setTotalLifetimeReps: () => {},
        setTotalXp: () => {},
        addGuestReps: () => {},
        repsIntoCurrentLevel: 0,
        repsNeededForNextLevel: 1,
        sessions: [] as import('@hooks/useSessionHistory').SessionRecord[],
        setSessions: () => {},
        totalSessionCount: 0,
        setTotalSessionCount: () => {},
    };

    return (
        <AuthContext.Provider value={baseValue}>
            <AppServices>
                {children}
            </AppServices>
        </AuthContext.Provider>
    );
}

