import { useEffect, useCallback } from 'react';
import { doc, getDoc, onSnapshot, collection, query, orderBy, limit, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import type { SessionRecord } from './useSessionHistory';

const LOCAL_STORAGE_REPS_KEY = 'pushup_game_total_reps';
const LOCAL_STORAGE_SESSIONS_KEY = 'pushup-sessions';

/**
 * useSyncCloud
 * Handles the bidirectional synchronization between local storage and Firestore.
 * - On login/register: Merges local reps and sessions into Firestore, then clears local storage.
 * - While logged in: Subscribes to Firestore for realtime updates to level/reps and sessions.
 */
export function useSyncCloud(
    setTotalLifetimeReps?: (reps: number) => void,
    setCloudSessions?: (sessions: SessionRecord[]) => void,
    setTotalSessionCount?: (count: number) => void
) {
    const { user } = useAuth();

    // 1. Merge local data to cloud on first login
    const mergeLocalToCloud = useCallback(async (uid: string) => {
        const localRepsRaw = localStorage.getItem(LOCAL_STORAGE_REPS_KEY);
        const localSessionsRaw = localStorage.getItem(LOCAL_STORAGE_SESSIONS_KEY);

        const localReps = localRepsRaw ? parseInt(localRepsRaw, 10) : 0;
        let localSessions: SessionRecord[] = [];
        try {
            if (localSessionsRaw) localSessions = JSON.parse(localSessionsRaw);
        } catch (e) { console.error('Failed to parse local sessions', e); }

        if (localReps > 0 || localSessions.length > 0) {
            console.log('Merging local data to cloud...', { localReps, sessions: localSessions.length });

            const batch = writeBatch(db);
            const userRef = doc(db, 'users', uid);

            // Get current cloud reps to add local reps to it
            const userDoc = await getDoc(userRef);
            const cloudReps = userDoc.exists() ? (userDoc.data().totalReps || 0) : 0;

            batch.set(userRef, {
                totalReps: cloudReps + localReps
            }, { merge: true });

            // Batch write all local sessions to the user's sessions subcollection
            localSessions.forEach(session => {
                const sessionRef = doc(collection(db, 'users', uid, 'sessions'), session.id);
                batch.set(sessionRef, session);
            });

            await batch.commit();

            // Clear local storage so we don't merge them again
            localStorage.removeItem(LOCAL_STORAGE_REPS_KEY);
            localStorage.removeItem(LOCAL_STORAGE_SESSIONS_KEY);
            console.log('Merge complete. Local storage cleared.');
        }
    }, []);

    // 2. Setup Realtime Listeners when authenticated
    useEffect(() => {
        if (!user) {
            // Guest mode: reset to local storage values
            if (setTotalLifetimeReps) {
                const localReps = localStorage.getItem(LOCAL_STORAGE_REPS_KEY);
                setTotalLifetimeReps(localReps ? parseInt(localReps, 10) : 0);
            }
            if (setCloudSessions) {
                const localRaw = localStorage.getItem(LOCAL_STORAGE_SESSIONS_KEY);
                try {
                    setCloudSessions(localRaw ? JSON.parse(localRaw) : []);
                } catch { setCloudSessions([]); }
            }
            if (setTotalSessionCount) {
                const localCount = localStorage.getItem('pushup_game_total_sessions');
                setTotalSessionCount(localCount ? parseInt(localCount, 10) : 0);
            }
            return;
        }

        // Trigger merge check
        mergeLocalToCloud(user.uid);

        // Listen to User Profile (Total Reps)
        const userRef = doc(db, 'users', user.uid);
        const unsubUser = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.totalReps !== undefined && setTotalLifetimeReps) {
                    setTotalLifetimeReps(data.totalReps);
                }
                if (data.totalSessions !== undefined && setTotalSessionCount) {
                    setTotalSessionCount(data.totalSessions);
                }
            }
        });

        // Listen to Sessions subcollection (Last 5)
        const sessionsRef = collection(db, 'users', user.uid, 'sessions');
        const q = query(sessionsRef, orderBy('date', 'desc'), limit(5));
        const unsubSessions = onSnapshot(q, (snapshot) => {
            const sessions: SessionRecord[] = [];
            snapshot.forEach(docSnap => {
                sessions.push(docSnap.data() as SessionRecord);
            });
            if (setCloudSessions) setCloudSessions(sessions);
        });

        return () => {
            unsubUser();
            unsubSessions();
        };
    }, [user, mergeLocalToCloud, setTotalLifetimeReps, setCloudSessions]);
}
