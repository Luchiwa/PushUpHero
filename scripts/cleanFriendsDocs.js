/**
 * cleanFriendsDocs.js
 *
 * Removes stale stats fields (level, totalReps, totalSessions) from all
 * users/{uid}/friends/{friendUid} subcollection documents.
 *
 * These fields were previously copied at the moment of friend-acceptance and
 * never updated afterward. Stats are now read live from users/{friendUid}
 * directly, so these copies are both stale and no longer needed.
 *
 * Usage:
 *   node scripts/cleanFriendsDocs.js
 *
 * Requirements:
 *   npm install firebase-admin --save-dev   (or globally)
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccount = JSON.parse(
    readFileSync(resolve(__dirname, '../firebase-service-account.json'), 'utf8')
);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const STALE_FIELDS = ['level', 'totalReps', 'totalSessions'];
const BATCH_SIZE = 400; // Firestore batch limit is 500

async function run() {
    console.log('🔍 Scanning all users for stale friends docs...\n');

    const usersSnap = await db.collection('users').get();
    console.log(`👥 Found ${usersSnap.size} users.\n`);

    let totalDocs = 0;
    let totalCleaned = 0;

    for (const userDoc of usersSnap.docs) {
        const uid = userDoc.id;
        const friendsSnap = await db.collection('users').doc(uid).collection('friends').get();

        if (friendsSnap.empty) continue;

        // Filter only docs that actually have at least one stale field
        const docsToClean = friendsSnap.docs.filter(d =>
            STALE_FIELDS.some(field => d.data()[field] !== undefined)
        );

        totalDocs += friendsSnap.size;

        if (docsToClean.length === 0) continue;

        console.log(`  🧹 User ${uid}: cleaning ${docsToClean.length}/${friendsSnap.size} friends docs`);

        // Process in batches
        for (let i = 0; i < docsToClean.length; i += BATCH_SIZE) {
            const batch = db.batch();
            const chunk = docsToClean.slice(i, i + BATCH_SIZE);
            const deleteMap = Object.fromEntries(STALE_FIELDS.map(f => [f, FieldValue.delete()]));
            chunk.forEach(d => batch.update(d.ref, deleteMap));
            await batch.commit();
        }

        totalCleaned += docsToClean.length;
    }

    console.log(`\n✅ Done. Scanned ${totalDocs} friends docs across ${usersSnap.size} users.`);
    console.log(`   Cleaned ${totalCleaned} docs (removed fields: ${STALE_FIELDS.join(', ')}).`);
}

run().catch(err => {
    console.error('❌ Script failed:', err);
    process.exit(1);
});
