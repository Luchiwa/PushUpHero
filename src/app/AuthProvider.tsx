/**
 * AuthProvider — Three nested providers, no Consumer/Provider anti-pattern.
 *
 * Structure:
 *   AuthCoreContext.Provider  (user, dbUser, auth methods)
 *     └─ LevelAndSessionProvider  (mounts useLevelSystem + useSyncCloud once)
 *         ├─ LevelContext.Provider  (XP, level, per-exercise)
 *         └─ SessionContext.Provider  (sessions, count)
 */
import { useState, useEffect, useMemo } from 'react';
import { onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '@lib/firebase';
import { AuthCoreContext, LevelContext, SessionContext } from '@hooks/useAuth';
import type { DbUser, AuthCoreContextType, LevelContextType, SessionContextType } from '@hooks/useAuth';
import { useLevelSystem } from '@hooks/useLevelSystem';
import { useNotifications } from '@hooks/useNotifications';
import { useSyncCloud } from '@hooks/useSyncCloud';
import { clearAllLocalStorage } from '@lib/clearLocalStorage';
import { invalidateAvatarCache } from '@hooks/useAvatarCache';
import type { SessionRecord } from '@hooks/useSessionHistory';

// ── Inner provider: Level + Sessions (mounts expensive hooks once) ──

function LevelAndSessionProvider({ children }: { children: React.ReactNode }) {
    const levelSystem = useLevelSystem();
    useNotifications();

    const [sessions, setSessions] = useState<SessionRecord[]>([]);
    const [totalSessionCount, setTotalSessionCount] = useState<number>(0);

    useSyncCloud(levelSystem.setTotalXp, levelSystem.setExerciseXp, setSessions, setTotalSessionCount);

    const levelValue = useMemo<LevelContextType>(() => levelSystem, [
        levelSystem.totalXp,
        levelSystem.exerciseXp,
        levelSystem.level,
        levelSystem.xpIntoCurrentLevel,
        levelSystem.xpNeededForNextLevel,
        levelSystem.levelProgressPct,
        levelSystem.addGuestXp,
        levelSystem.getExerciseLevel,
        levelSystem.getExerciseXp,
        levelSystem.getExerciseLevelProgress,
        levelSystem.setTotalXp,
        levelSystem.setExerciseXp,
    ]);

    const sessionValue = useMemo<SessionContextType>(() => ({
        sessions,
        setSessions,
        totalSessionCount,
        setTotalSessionCount,
    }), [sessions, totalSessionCount]);

    return (
        <LevelContext.Provider value={levelValue}>
            <SessionContext.Provider value={sessionValue}>
                {children}
            </SessionContext.Provider>
        </LevelContext.Provider>
    );
}

// ── Outer provider: Auth core ───────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState(null as import('firebase/auth').User | null);
    const [dbUser, setDbUser] = useState<DbUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let prevUser: import('firebase/auth').User | null = null;
        let unsubUserDoc: (() => void) | undefined;

        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            // Tear down the previous user's Firestore listener first
            if (unsubUserDoc) {
                unsubUserDoc();
                unsubUserDoc = undefined;
            }

            // If user was logged in and is now null → logout or account deletion
            // Clear localStorage synchronously BEFORE React re-renders child hooks
            if (prevUser && !firebaseUser) {
                clearAllLocalStorage();
            }
            prevUser = firebaseUser;

            setUser(firebaseUser);
            if (firebaseUser) {
                const userRef = doc(db, 'users', firebaseUser.uid);
                unsubUserDoc = onSnapshot(userRef, (docSnap) => {
                    if (docSnap.exists()) {
                        setDbUser(docSnap.data() as DbUser);
                    } else {
                        setDbUser(null);
                    }
                    setLoading(false);
                });
            } else {
                setDbUser(null);
                setLoading(false);
            }
        });

        return () => {
            unsubscribe();
            if (unsubUserDoc) {
                unsubUserDoc();
            }
        };
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
        const bitmap = await createImageBitmap(file);
        const size = Math.min(512, bitmap.width, bitmap.height);
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context unavailable');
        const srcSize = Math.min(bitmap.width, bitmap.height);
        const sx = (bitmap.width - srcSize) / 2;
        const sy = (bitmap.height - srcSize) / 2;
        ctx.drawImage(bitmap, sx, sy, srcSize, srcSize, 0, 0, size, size);
        const blob = await new Promise<Blob>((resolve, reject) =>
            canvas.toBlob((b) => { if (b) resolve(b); else reject(new Error('toBlob failed')); }, 'image/jpeg', 0.85)
        );
        const storageRef = ref(storage, `avatars/${user.uid}.jpg`);
        await user.getIdToken(true);
        await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
        const url = await getDownloadURL(storageRef);
        if (dbUser?.photoURL) await invalidateAvatarCache(dbUser.photoURL);
        await updateDoc(doc(db, 'users', user.uid), { photoURL: url });
        setDbUser(prev => prev ? { ...prev, photoURL: url } : prev);
    };

    const logout = async () => {
        await signOut(auth);
        // localStorage is cleared in the onAuthStateChanged handler above
    };

    const authCoreValue = useMemo<AuthCoreContextType>(() => ({
        user, dbUser, loading, loginWithGoogle, logout, uploadAvatar,
    }), [user, dbUser, loading]);

    return (
        <AuthCoreContext.Provider value={authCoreValue}>
            <LevelAndSessionProvider>
                {children}
            </LevelAndSessionProvider>
        </AuthCoreContext.Provider>
    );
}
