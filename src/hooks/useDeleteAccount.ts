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
 *
 * Strategy: clean Firestore & Storage FIRST (while we still have auth),
 * then delete the Firebase Auth account last (which revokes the token).
 */
export async function deleteCurrentAccount(): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');

    const uid = user.uid;
    const userRef = doc(db, 'users', uid);

    // ── 1. Release username claim ────────────────────────────────
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
        const displayName = userSnap.data().displayName;
        if (displayName) {
            const usernameKey = displayName.trim().toLowerCase();
            await deleteDoc(doc(db, 'usernames', usernameKey));
        }
    }

    // ── 2. Read cross-user references BEFORE deleting own data ───
    const [friendsSnap, sentSnap, receivedSnap] = await Promise.all([
        getDocs(collection(userRef, 'friends')),
        getDocs(collection(userRef, 'friendRequestsSent')),
        getDocs(collection(userRef, 'friendRequests')),
    ]);

    // ── 3. Clean cross-user data ─────────────────────────────────
    const crossBatch = writeBatch(db);

    for (const friendDoc of friendsSnap.docs) {
        const friendUid = friendDoc.id;
        const base = doc(db, 'users', friendUid);
        crossBatch.delete(doc(collection(base, 'friends'), uid));
        crossBatch.delete(doc(collection(base, 'friendRequests'), uid));
        crossBatch.delete(doc(collection(base, 'friendRequestsSent'), uid));
    }

    for (const sentDoc of sentSnap.docs) {
        const toUid = sentDoc.id;
        crossBatch.delete(doc(collection(doc(db, 'users', toUid), 'friendRequests'), uid));
    }

    for (const receivedDoc of receivedSnap.docs) {
        const fromUid = receivedDoc.id;
        crossBatch.delete(doc(collection(doc(db, 'users', fromUid), 'friendRequestsSent'), uid));
    }

    await crossBatch.commit();

    // ── 4. Delete own subcollections ─────────────────────────────
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

    // ── 5. Delete user profile document ─────────────────────────
    await deleteDoc(userRef);

    // ── 6. Delete avatar from Storage (ignore if not found) ──────
    try {
        await deleteObject(ref(storage, `avatars/${uid}.jpg`));
    } catch {
        // File may not exist if user never uploaded an avatar
    }

    // ── 7. Delete Firebase Auth account LAST ─────────────────────
    //       This revokes the token and triggers onAuthStateChanged(null),
    //       which clears localStorage and tears down Firestore listeners.
    await deleteUser(user);

    // ── 8. Belt-and-suspenders: clear localStorage ───────────────
    //       onAuthStateChanged handler also does this, but ensure it
    //       happens even if the handler fires asynchronously.
    localStorage.clear();
}
