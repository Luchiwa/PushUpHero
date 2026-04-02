/**
 * useBodyProfile — Persists BodyProfile in localStorage
 * and syncs to Firestore when logged in.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuthCore } from './useAuth';
import { updateBodyProfile } from '@lib/userService';
import type { BodyProfile } from '@lib/bodyProfile';
import { emptyBodyProfile, BODY_PROFILE_VERSION } from '@lib/bodyProfile';

const LS_PROFILE_KEY = 'pushup-hero-body-profile';

function loadProfile(): BodyProfile {
    try {
        const raw = localStorage.getItem(LS_PROFILE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as BodyProfile;
            if (parsed.version === BODY_PROFILE_VERSION) return parsed;
        }
    } catch { /* corrupt data, ignore */ }
    return emptyBodyProfile();
}

export function useBodyProfile() {
    const { user, dbUser } = useAuthCore();
    const [bodyProfile, setBodyProfileState] = useState<BodyProfile>(loadProfile);
    const initialLoadDone = useRef(false);

    // Hydrate from Firestore on login (cloud takes priority)
    useEffect(() => {
        if (!dbUser || !user || initialLoadDone.current) return;
        initialLoadDone.current = true;

        const localProfile = loadProfile();

        if (dbUser.bodyProfile && dbUser.bodyProfile.version === BODY_PROFILE_VERSION) {
            setBodyProfileState(dbUser.bodyProfile);
            localStorage.setItem(LS_PROFILE_KEY, JSON.stringify(dbUser.bodyProfile));
        } else if (localProfile.capturedAt > 0) {
            updateBodyProfile(user.uid, localProfile).catch(console.error);
        }
    }, [dbUser, user]);

    // Reset on logout
    const prevUserRef = useRef(user);
    useEffect(() => {
        if (!user && prevUserRef.current) {
            initialLoadDone.current = false;
            setBodyProfileState(emptyBodyProfile());
        }
        prevUserRef.current = user;
    }, [user]);

    const saveBodyProfile = useCallback((profile: BodyProfile) => {
        setBodyProfileState(profile);
        localStorage.setItem(LS_PROFILE_KEY, JSON.stringify(profile));
        if (user) {
            updateBodyProfile(user.uid, profile).catch(console.error);
        }
    }, [user]);

    return { bodyProfile, saveBodyProfile };
}
