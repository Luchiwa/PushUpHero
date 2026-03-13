import { deleteUser } from 'firebase/auth';
import {
    collection,
    deleteDoc,
    doc,
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

    // ── 1. Release username claim ────────────────────────────────
    const userSnap = await getDocs(collection(db, 'usernames'));
    for (const d of userSnap.docs) {
        if (d.data().uid === uid) {
            await deleteDoc(d.ref);
            break;
        }
    }

    // ── 2. Delete own subcollections ─────────────────────────────
    const subcollections = [
        'sessions',
        'friends',
        'friendRequests',
        'friendRequestsSent',
        'notifications',
    ] as const;

    for (const sub of subcollections) {
        const snap = await getDocs(collection(userRef, sub));
        if (!snap.empty) {
            const batch = writeBatch(db);
            snap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
        }
    }

    // ── 3. Clean cross-user data ─────────────────────────────────
    const [friendsSnap, sentSnap, receivedSnap] = await Promise.all([
        getDocs(collection(userRef, 'friends')),
        getDocs(collection(userRef, 'friendRequestsSent')),
        getDocs(collection(userRef, 'friendRequests')),
    ]);

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

    // ── 4. Delete user profile document ─────────────────────────
    await deleteDoc(userRef);

    // ── 5. Delete avatar from Storage (ignore if not found) ──────
    try {
        await deleteObject(ref(storage, `avatars/${uid}.jpg`));
    } catch {
        // File may not exist if user never uploaded an avatar
    }

    // ── 6. Delete Firebase Auth account ─────────────────────────
    await deleteUser(user);

    // ── 7. Clear local storage ───────────────────────────────────
    localStorage.clear();
}
