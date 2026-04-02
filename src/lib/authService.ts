/**
 * authService.ts
 *
 * All Firebase Auth operations live here — no React, no hooks.
 * UI components never import firebase/auth directly.
 */

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    EmailAuthProvider,
    GoogleAuthProvider,
    reauthenticateWithCredential,
    reauthenticateWithPopup,
    updatePassword as fbUpdatePassword,
} from 'firebase/auth';
import { runTransaction } from 'firebase/firestore';
import { auth, db } from './firebase';
import { userRef, usernameRef } from './refs';

// ── Error translation ────────────────────────────────────────────────────────

/** Translates Firebase Auth error codes into user-friendly messages. */
export function translateAuthError(err: unknown): string {
    const code = (err as { code?: string }).code;
    switch (code) {
        case 'auth/email-already-in-use': return 'This email is already in use.';
        case 'auth/invalid-credential':
        case 'auth/wrong-password': return 'Incorrect email or password.';
        case 'auth/requires-recent-login': return 'Session expired. Please sign out and sign in again.';
        case 'auth/user-not-found': return 'No account found with this email.';
        case 'auth/too-many-requests': return 'Too many attempts. Please try again later.';
        default: return (err as Error).message || 'An error occurred.';
    }
}

// ── Sign-in ──────────────────────────────────────────────────────────────────

export async function loginWithEmail(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(auth, email, password);
}

// ── Re-authentication ────────────────────────────────────────────────────────

export async function reauthenticateWithGoogle(): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    await reauthenticateWithPopup(user, new GoogleAuthProvider());
}

export async function reauthenticateWithEmail(password: string): Promise<void> {
    const user = auth.currentUser;
    if (!user?.email) throw new Error('No authenticated user');
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);
}

// ── Password change ──────────────────────────────────────────────────────────

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await reauthenticateWithEmail(currentPassword);
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    await fbUpdatePassword(user, newPassword);
}

/**
 * Register a new user with email/password, claim a unique username,
 * and create the initial Firestore profile — all inside a transaction.
 */
export async function registerWithEmail(
    email: string,
    password: string,
    username: string,
): Promise<void> {
    const cleanUsername = username.trim().toLowerCase();

    await runTransaction(db, async (transaction) => {
        const uRef = usernameRef(cleanUsername);
        const usernameDoc = await transaction.get(uRef);

        if (usernameDoc.exists()) {
            throw new Error('This username is already taken!');
        }

        // Create the user in Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Claim username
        transaction.set(uRef, { uid: user.uid });

        // Create base DB profile
        transaction.set(userRef(user.uid), {
            uid: user.uid,
            displayName: username.trim(),
            level: 0,
            totalXp: 0,
            totalReps: 0,
            totalSessions: 0,
            exerciseXp: {},
            exerciseLevels: {},
            createdAt: Date.now(),
        });
    });
}
