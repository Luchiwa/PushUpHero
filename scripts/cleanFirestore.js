import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SERVICE_ACCOUNT_PATH = join(__dirname, '..', 'firebase-service-account.json');

async function main() {
    const email = process.argv[2];

    if (!email) {
        console.error("❌ Erreur : Tu dois fournir l'adresse email du compte à supprimer.");
        console.error("👉 Usage : npm run cleanFirestore <email>");
        process.exit(1);
    }

    try {
        // 1. Charger la clé de service (Service Account)
        const serviceAccountRaw = await readFile(SERVICE_ACCOUNT_PATH, 'utf-8');
        const serviceAccount = JSON.parse(serviceAccountRaw);

        // 2. Initialiser le Firebase Admin SDK
        initializeApp({
            credential: cert(serviceAccount)
        });

        const auth = getAuth();
        const db = getFirestore();

        console.log(`🔎 Recherche de l'utilisateur avec l'email : ${email}...`);

        // 3. Récupérer l'utilisateur via l'Auth
        const userRecord = await auth.getUserByEmail(email);
        const uid = userRecord.uid;
        console.log(`✅ Utilisateur trouvé ! UID: ${uid}`);

        // 4. Supprimer le pseudo dans la collection "usernames" pour le libérer
        const userDocRef = db.collection('users').doc(uid);
        const userDoc = await userDocRef.get();

        if (userDoc.exists) {
            const displayName = userDoc.data()?.displayName;
            if (displayName) {
                const usernameLower = displayName.toLowerCase();
                console.log(`🗑️ Libération du pseudo "${displayName}"...`);
                await db.collection('usernames').doc(usernameLower).delete();
            }
        }

        // 5. Supprimer toutes les sessions de l'utilisateur
        console.log(`🗑️ Suppression de la sous-collection "sessions"...`);
        const sessionsSnapshot = await userDocRef.collection('sessions').get();
        const batch = db.batch();

        sessionsSnapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });

        if (!sessionsSnapshot.empty) {
            await batch.commit();
            console.log(`✅ ${sessionsSnapshot.size} sessions supprimées.`);
        }

        // 6. Supprimer le document utilisateur (Profil)
        console.log(`🗑️ Suppression du profil utilisateur Firestore...`);
        await userDocRef.delete();

        // 7. Supprimer définitivement le compte Firebase Auth
        console.log(`🗑️ Suppression du compte Firebase Auth...`);
        await auth.deleteUser(uid);

        console.log(`🎉 Succès ! Le compte "${email}" et toutes ses données ont été complètement purgés.`);

    } catch (error) {
        if (error.code === 'auth/user-not-found') {
            console.error(`❌ Erreur : Aucun utilisateur trouvé avec l'email "${email}".`);
        } else if (error.code === 'ENOENT') {
            console.error(`❌ Erreur : Le fichier "firebase-service-account.json" est introuvable à la racine du projet.`);
        } else {
            console.error(`❌ Une erreur est survenue :`, error);
        }
    }
}

main();
