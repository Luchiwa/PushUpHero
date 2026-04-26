import { deleteUser, signOut } from 'firebase/auth';
import { deleteDoc, getDoc, getDocs, writeBatch } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { auth, db, storage } from '@infra/firebase';
import {
    userRef, usernameRef,
    friendsCol, friendRef, friendRequestRef, sentRequestRef,
    sessionsCol, friendRequestsCol, sentRequestsCol, notificationsCol, activityFeedCol,
} from '@infra/refs';
import { clearAll } from '@infra/storage';
import { createUserId } from '@domain/brands';

/**
 * Deletes the current user's account and all associated Firestore data.
 *
 * Strategy: clean Firestore & Storage FIRST (while we still have auth),
 * then delete the Firebase Auth account last (which revokes the token).
 */
export async function deleteCurrentAccount(): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');

    const uid = createUserId(user.uid);

    // ── 1. Release username claim ────────────────────────────────
    const userSnap = await getDoc(userRef(uid));
    if (userSnap.exists()) {
        const displayName = userSnap.data().displayName;
        if (displayName) {
            const usernameKey = displayName.trim().toLowerCase();
            await deleteDoc(usernameRef(usernameKey));
        }
    }

    // ── 2. Read cross-user references BEFORE deleting own data ───
    const [friendsSnap, sentSnap, receivedSnap] = await Promise.all([
        getDocs(friendsCol(uid)),
        getDocs(sentRequestsCol(uid)),
        getDocs(friendRequestsCol(uid)),
    ]);

    // ── 3. Clean cross-user data ─────────────────────────────────
    const crossBatch = writeBatch(db);

    for (const friendDoc of friendsSnap.docs) {
        const friendUid = createUserId(friendDoc.id);
        crossBatch.delete(friendRef(friendUid, uid));
        crossBatch.delete(friendRequestRef(friendUid, uid));
        crossBatch.delete(sentRequestRef(friendUid, uid));
    }

    for (const sentDoc of sentSnap.docs) {
        const toUid = createUserId(sentDoc.id);
        crossBatch.delete(friendRequestRef(toUid, uid));
    }

    for (const receivedDoc of receivedSnap.docs) {
        const fromUid = createUserId(receivedDoc.id);
        crossBatch.delete(sentRequestRef(fromUid, uid));
    }

    await crossBatch.commit();

    // ── 4. Delete own subcollections ─────────────────────────────
    const subcollectionRefs = [
        sessionsCol(uid),
        friendsCol(uid),
        friendRequestsCol(uid),
        sentRequestsCol(uid),
        notificationsCol(uid),
        activityFeedCol(uid),
    ];

    for (const colRef of subcollectionRefs) {
        const snap = await getDocs(colRef);
        if (!snap.empty) {
            const batch = writeBatch(db);
            snap.docs.forEach(d => { batch.delete(d.ref); });
            await batch.commit();
        }
    }

    // ── 5. Delete user profile document ─────────────────────────
    await deleteDoc(userRef(uid));

    // ── 6. Delete avatar from Storage (ignore if not found) ──────
    try {
        await deleteObject(ref(storage, `avatars/${uid}.jpg`));
    } catch {
        // File may not exist if user never uploaded an avatar
    }

    // ── 7. Delete Firebase Auth account LAST ─────────────────────
    try {
        await deleteUser(user);
    } catch (authErr) {
        console.warn('[deleteAccount] deleteUser failed, forcing sign-out:', authErr);
        await signOut(auth);
    }

    // ── 8. Belt-and-suspenders: clear localStorage ───────────────
    clearAll();
}
