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
import { subscribeAuthState, signInWithGoogle, logoutSession } from '@services/authService';
import { uploadAvatar as uploadAvatarService } from '@services/avatarService';
import { onUserProfile } from '@data/userRepository';
import { AuthCoreContext, LevelContext, SessionContext } from '@hooks/useAuth';
import type { AppUser, DbUser, AuthCoreContextType, LevelContextType, SessionContextType } from '@hooks/useAuth';
import { useLevelSystem } from '@hooks/useLevelSystem';
import { useNotifications } from '@hooks/useNotifications';
import { useSyncCloud } from '@hooks/useSyncCloud';
import { clearAppKeys } from '@infra/storage';
import { FeedCacheProvider } from './FeedCacheContext';
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
                <FeedCacheProvider>
                    {children}
                </FeedCacheProvider>
            </SessionContext.Provider>
        </LevelContext.Provider>
    );
}

// ── Outer provider: Auth core ───────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AppUser | null>(null);
    const [dbUser, setDbUser] = useState<DbUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let prevUser: AppUser | null = null;
        let unsubUserDoc: (() => void) | undefined;

        const unsubscribe = subscribeAuthState((appUser) => {
            // Tear down the previous user's Firestore listener first
            if (unsubUserDoc) {
                unsubUserDoc();
                unsubUserDoc = undefined;
            }

            // If user was logged in and is now null → logout or account deletion
            // Clear localStorage synchronously BEFORE React re-renders child hooks
            if (prevUser && !appUser) {
                clearAppKeys();
            }
            prevUser = appUser;

            setUser(appUser);
            if (appUser) {
                unsubUserDoc = onUserProfile(
                    appUser.uid,
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
        try {
            await signInWithGoogle();
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
        await logoutSession();
        // localStorage is cleared inside subscribeAuthState's callback when user → null
    }, []);

    const authCoreValue = useMemo<AuthCoreContextType>(() => ({
        user, dbUser, loading, loginWithGoogle, logout, uploadAvatar,
    }), [user, dbUser, loading, loginWithGoogle, logout, uploadAvatar]);

    return (
        <AuthCoreContext.Provider value={authCoreValue}>
            <LevelAndSessionProvider>
                {children}
            </LevelAndSessionProvider>
        </AuthCoreContext.Provider>
    );
}
