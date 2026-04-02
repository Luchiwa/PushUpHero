/**
 * avatarService.ts
 *
 * Avatar upload & processing — no React, no hooks.
 * Handles image resize, thumbnail generation, Storage upload, and Firestore update.
 */

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateDoc } from 'firebase/firestore';
import { auth, storage } from './firebase';
import { userRef } from './refs';
import { invalidateAvatarCache } from './avatarCache';

const AVATAR_SIZE = 512;
const THUMB_SIZE = 96;
const JPEG_QUALITY = 0.85;
const THUMB_QUALITY = 0.7;

/** Crop, resize, upload to Storage, and update the user doc with URL + base64 thumbnail. */
export async function uploadAvatar(uid: string, file: File, currentPhotoURL?: string): Promise<{ photoURL: string; photoThumb: string }> {
    const bitmap = await createImageBitmap(file);
    const srcSize = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - srcSize) / 2;
    const sy = (bitmap.height - srcSize) / 2;

    // Full-size avatar
    const size = Math.min(AVATAR_SIZE, bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.drawImage(bitmap, sx, sy, srcSize, srcSize, 0, 0, size, size);
    const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => { if (b) resolve(b); else reject(new Error('toBlob failed')); }, 'image/jpeg', JPEG_QUALITY),
    );

    // Base64 thumbnail for instant display
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = THUMB_SIZE;
    thumbCanvas.height = THUMB_SIZE;
    const thumbCtx = thumbCanvas.getContext('2d')!;
    thumbCtx.drawImage(bitmap, sx, sy, srcSize, srcSize, 0, 0, THUMB_SIZE, THUMB_SIZE);
    const photoThumb = thumbCanvas.toDataURL('image/jpeg', THUMB_QUALITY);

    // Force token refresh (required by Storage security rules)
    const user = auth.currentUser;
    if (user) await user.getIdToken(true);

    const storageRef = ref(storage, `avatars/${uid}.jpg`);
    await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
    const photoURL = await getDownloadURL(storageRef);

    if (currentPhotoURL) await invalidateAvatarCache(currentPhotoURL);
    await updateDoc(userRef(uid), { photoURL, photoThumb });

    return { photoURL, photoThumb };
}
