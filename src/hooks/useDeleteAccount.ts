import { deleteUser } from 'firebase/auth';
import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    writeBatch,
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { auth, db, storage } from '@lib/firebase';

/**
 * Deletes the current user's account and all associated Firestore data.
 * Mirrors the logic of scripts/cleanFirestore.js, using the client SDK.
 */
export async function deleteCurrentAccount(): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');

    const uid = user.uid;
    const userRef = doc(db, 'users', uid);

    // ── 1. Delete Firebase Auth account FIRST (fail-fast before any data mutation)
    //       If the session is stale this throws auth/requires-recent-login before
    //       we touch Firestore, keeping data and Auth in sync.
    await deleteUser(user);

    // ── 2. Release username claim ────────────────────────────────
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
        const displayName = userSnap.data().displayName;
        if (displayName) {
            const usernameKey = displayName.trim().toLowerCase();
            await deleteDoc(doc(db, 'usernames', usernameKey));
        }
    }

    // ── 3. Read cross-user references BEFORE deleting own data ───
    const [friendsSnap, sentSnap, receivedSnap] = await Promise.all([
        getDocs(collection(userRef, 'friends')),
        getDocs(collection(userRef, 'friendRequestsSent')),
        getDocs(collection(userRef, 'friendRequests')),
    ]);

    // ── 4. Clean cross-user data ─────────────────────────────────
    const crossBatch = writeBatch(db);

    // Remove this user from friends' lists & their pending requests
    for (const friendDoc of friendsSnap.docs) {
        const friendUid = friendDoc.id;
        const base = doc(db, 'users', friendUid);
        crossBatch.delete(doc(collection(base, 'friends'), uid));
        crossBatch.delete(doc(collection(base, 'friendRequests'), uid));
        crossBatch.delete(doc(collection(base, 'friendRequestsSent'), uid));
    }

    // Remove sent requests at recipients
    for (const sentDoc of sentSnap.docs) {
        const toUid = sentDoc.id;
        crossBatch.delete(doc(collection(doc(db, 'users', toUid), 'friendRequests'), uid));
    }

    // Remove received requests at senders
    for (const receivedDoc of receivedSnap.docs) {
        const fromUid = receivedDoc.id;
        crossBatch.delete(doc(collection(doc(db, 'users', fromUid), 'friendRequestsSent'), uid));
    }

    await crossBatch.commit();

    // ── 5. Delete own subcollections ─────────────────────────────
    const subcollections = [
        'sessions',
        'friends',
        'friendRequests',
        'friendRequestsSent',
        'notifications',
        'activityFeed',
    ] as const;

    for (const sub of subcollections) {
        const snap = await getDocs(collection(userRef, sub));
        if (!snap.empty) {
            const batch = writeBatch(db);
            snap.docs.forEach(d => { batch.delete(d.ref); });
            await batch.commit();
        }
    }

    // ── 6. Delete user profile document ─────────────────────────
    await deleteDoc(userRef);

    // ── 7. Delete avatar from Storage (ignore if not found) ──────
    try {
        await deleteObject(ref(storage, `avatars/${uid}.jpg`));
    } catch {
        // File may not exist if user never uploaded an avatar
    }

    // ── 8. Clear local storage ───────────────────────────────────
    localStorage.clear();
}
