/**
 * useBodyProfile — Persists BodyProfile in localStorage
 * and syncs to Firestore when logged in.
 */
import { useState, useCallback, useEffect } from 'react';
import { useAuthCore } from './useAuth';
import { updateBodyProfile } from '@services/profileService';
import { read, write, STORAGE_KEYS } from '@infra/storage';
import type { BodyProfile } from '@domain/bodyProfile';
import { emptyBodyProfile, BODY_PROFILE_VERSION } from '@domain/bodyProfile';

function loadProfile(): BodyProfile {
    const stored = read<BodyProfile | null>(STORAGE_KEYS.bodyProfile, null);
    if (stored && stored.version === BODY_PROFILE_VERSION) return stored;
    return emptyBodyProfile();
}

export function useBodyProfile() {
    const { user, dbUser } = useAuthCore();
    const [bodyProfile, setBodyProfileState] = useState<BodyProfile>(loadProfile);
    const [hydratedForUid, setHydratedForUid] = useState<string | null>(null);
    const [prevUser, setPrevUser] = useState(user);

    // Hydrate from Firestore on login (pure state transition during render)
    const uid = user?.uid ?? null;
    if (dbUser && uid && hydratedForUid !== uid) {
        setHydratedForUid(uid);
        if (dbUser.bodyProfile && dbUser.bodyProfile.version === BODY_PROFILE_VERSION) {
            setBodyProfileState(dbUser.bodyProfile);
        }
    }

    // Reset on logout (pure state transition during render)
    if (user !== prevUser) {
        setPrevUser(user);
        if (!user && prevUser) {
            setHydratedForUid(null);
            setBodyProfileState(emptyBodyProfile());
        }
    }

    // Side effects: sync localStorage ↔ Firestore (runs after render)
    useEffect(() => {
        if (!dbUser || !uid) return;
        if (dbUser.bodyProfile && dbUser.bodyProfile.version === BODY_PROFILE_VERSION) {
            write(STORAGE_KEYS.bodyProfile, dbUser.bodyProfile);
        } else {
            const localProfile = loadProfile();
            if (localProfile.capturedAt > 0) {
                updateBodyProfile(uid, localProfile).catch(console.error);
            }
        }
    }, [dbUser, uid]);

    const saveBodyProfile = useCallback((profile: BodyProfile) => {
        setBodyProfileState(profile);
        write(STORAGE_KEYS.bodyProfile, profile);
        if (uid) {
            updateBodyProfile(uid, profile).catch(console.error);
        }
    }, [uid]);

    return { bodyProfile, saveBodyProfile };
}
