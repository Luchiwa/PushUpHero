/**
 * AuthProvider — Three nested providers, no Consumer/Provider anti-pattern.
 *
 * Structure:
 *   AuthCoreContext.Provider  (user, dbUser, auth methods)
 *     └─ LevelAndSessionProvider  (mounts useLevelSystem + useSyncCloud once)
 *         ├─ LevelContext.Provider  (XP, level, per-exercise)
 *         └─ SessionContext.Provider  (sessions, count)
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '@infra/firebase';
import { uploadAvatar as uploadAvatarService } from '@services/avatarService';
import { onUserProfile } from '@data/userRepository';
import { AuthCoreContext, LevelContext, SessionContext } from '@hooks/useAuth';
import type { AppUser, DbUser, AuthCoreContextType, LevelContextType, SessionContextType } from '@hooks/useAuth';
import { useLevelSystem } from '@hooks/useLevelSystem';
import { useNotifications } from '@hooks/useNotifications';
import { useSyncCloud } from '@hooks/useSyncCloud';
import { clearAllLocalStorage } from '@services/clearLocalStorage';
import type { SessionRecord } from '@exercises/types';

// ── Inner provider: Level + Sessions (mounts expensive hooks once) ──

function LevelAndSessionProvider({ children }: { children: React.ReactNode }) {
    const levelSystem = useLevelSystem();
    useNotifications();

    const [sessions, setSessions] = useState<SessionRecord[]>([]);
    const [totalSessionCount, setTotalSessionCount] = useState<number>(0);

    useSyncCloud(levelSystem.setTotalXp, levelSystem.setExerciseXp, setSessions, setTotalSessionCount);

    const levelValue = useMemo<LevelContextType>(() => ({
        totalXp: levelSystem.totalXp,
        exerciseXp: levelSystem.exerciseXp,
        level: levelSystem.level,
        xpIntoCurrentLevel: levelSystem.xpIntoCurrentLevel,
        xpNeededForNextLevel: levelSystem.xpNeededForNextLevel,
        levelProgressPct: levelSystem.levelProgressPct,
        addGuestXp: levelSystem.addGuestXp,
        getExerciseLevel: levelSystem.getExerciseLevel,
        getExerciseXp: levelSystem.getExerciseXp,
        getExerciseLevelProgress: levelSystem.getExerciseLevelProgress,
        setTotalXp: levelSystem.setTotalXp,
        setExerciseXp: levelSystem.setExerciseXp,
    }), [
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
                unsubUserDoc = onUserProfile(
                    firebaseUser.uid,
                    (data) => { setDbUser(data); setLoading(false); },
                    () => { setDbUser(null); setLoading(false); },
                );
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

    const loginWithGoogle = useCallback(async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error('Google sign in failed', error);
            throw error;
        }
    }, []);

    const uploadAvatar = useCallback(async (file: File) => {
        if (!user) throw new Error('Not authenticated');
        const { photoURL, photoThumb } = await uploadAvatarService(user.uid, file, dbUser?.photoURL);
        setDbUser(prev => prev ? { ...prev, photoURL, photoThumb } : prev);
    }, [user, dbUser?.photoURL]);

    const logout = useCallback(async () => {
        await signOut(auth);
        // localStorage is cleared in the onAuthStateChanged handler above
    }, []);

    const appUser = useMemo<AppUser | null>(() =>
        user ? { uid: user.uid, providerIds: user.providerData.map(p => p.providerId) } : null,
    [user]);

    const authCoreValue = useMemo<AuthCoreContextType>(() => ({
        user: appUser, dbUser, loading, loginWithGoogle, logout, uploadAvatar,
    }), [appUser, dbUser, loading, loginWithGoogle, logout, uploadAvatar]);

    return (
        <AuthCoreContext.Provider value={authCoreValue}>
            <LevelAndSessionProvider>
                {children}
            </LevelAndSessionProvider>
        </AuthCoreContext.Provider>
    );
}
