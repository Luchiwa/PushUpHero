import { useEffect, useCallback } from 'react';
import { doc, getDoc, onSnapshot, collection, query, orderBy, limit, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import type { SessionRecord } from './useSessionHistory';

const LOCAL_STORAGE_REPS_KEY = 'pushup_game_total_reps';
const LOCAL_STORAGE_SESSIONS_KEY = 'pushup-sessions';
const LOCAL_STORAGE_TOTAL_SESSIONS_KEY = 'pushup_game_total_sessions';
const MERGE_LOCK_KEY = 'pushup_merge_in_progress';

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

    // 1. Merge local data to cloud on first login — protected by a lock to prevent double-call
    const mergeLocalToCloud = useCallback(async (uid: string) => {
        // If another instance of this hook is already merging, bail out
        if (localStorage.getItem(MERGE_LOCK_KEY) === 'true') return;

        const localRepsRaw = localStorage.getItem(LOCAL_STORAGE_REPS_KEY);
        const localSessionsRaw = localStorage.getItem(LOCAL_STORAGE_SESSIONS_KEY);

        const localReps = localRepsRaw ? parseInt(localRepsRaw, 10) : 0;
        let localSessions: SessionRecord[] = [];
        try {
            if (localSessionsRaw) localSessions = JSON.parse(localSessionsRaw);
        } catch (e) { console.error('Failed to parse local sessions', e); }

        // Clear local storage immediately to prevent any concurrent merge from picking up same data
        localStorage.setItem(MERGE_LOCK_KEY, 'true');
        localStorage.removeItem(LOCAL_STORAGE_REPS_KEY);
        localStorage.removeItem(LOCAL_STORAGE_SESSIONS_KEY);
        localStorage.removeItem(LOCAL_STORAGE_TOTAL_SESSIONS_KEY);

        if (localReps > 0 || localSessions.length > 0) {
            console.log('Merging local data to cloud...', { localReps, sessions: localSessions.length });

            try {
                const batch = writeBatch(db);
                const userRef = doc(db, 'users', uid);

                // Get current cloud reps and sessions count to add local data to it
                const userDoc = await getDoc(userRef);
                const cloudReps = userDoc.exists() ? (userDoc.data().totalReps || 0) : 0;
                const cloudSessions = userDoc.exists() ? (userDoc.data().totalSessions || 0) : 0;

                batch.set(userRef, {
                    totalReps: cloudReps + localReps,
                    totalSessions: cloudSessions + localSessions.length
                }, { merge: true });

                localSessions.forEach(session => {
                    const sessionRef = doc(collection(db, 'users', uid, 'sessions'), session.id);
                    batch.set(sessionRef, session);
                });

                await batch.commit();
                console.log('Merge complete.');
            } catch (e) {
                console.error('Merge failed', e);
            }
        }

        localStorage.removeItem(MERGE_LOCK_KEY);
    }, []);

    // 2. Setup Realtime Listeners when authenticated
    useEffect(() => {
        if (!user) {
            // Guest mode: read from localStorage and display locally stored values
            if (setTotalLifetimeReps) {
                const localReps = localStorage.getItem(LOCAL_STORAGE_REPS_KEY);
                setTotalLifetimeReps(localReps ? parseInt(localReps, 10) : 0);
            }
            if (setCloudSessions) {
                try {
                    const localRaw = localStorage.getItem(LOCAL_STORAGE_SESSIONS_KEY);
                    setCloudSessions(localRaw ? JSON.parse(localRaw) : []);
                } catch { setCloudSessions([]); }
            }
            if (setTotalSessionCount) {
                const localCount = localStorage.getItem(LOCAL_STORAGE_TOTAL_SESSIONS_KEY);
                setTotalSessionCount(localCount ? parseInt(localCount, 10) : 0);
            }
            return;
        }

        // Logged in: merge any guest data into cloud, then listen to Firestore
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
