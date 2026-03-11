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

        // 5. Supprimer toutes les sous-collections de l'utilisateur
        const subcollections = ['sessions', 'friends', 'friendRequests', 'friendRequestsSent', 'notifications'];
        for (const sub of subcollections) {
            const snapshot = await userDocRef.collection(sub).get();
            if (!snapshot.empty) {
                const batch = db.batch();
                snapshot.docs.forEach((doc) => batch.delete(doc.ref));
                await batch.commit();
                console.log(`✅ ${snapshot.size} document(s) supprimé(s) dans "${sub}".`);
            } else {
                console.log(`ℹ️  Sous-collection "${sub}" vide ou inexistante.`);
            }
        }

        // 6. Nettoyer les données croisées chez les amis
        console.log(`🔎 Nettoyage des données croisées chez les autres utilisateurs...`);

        // Supprimer ce compte de la liste d'amis de ses amis
        const friendsSnapshot = await userDocRef.collection('friends').get();
        const crossBatch = db.batch();
        let crossCount = 0;

        for (const friendDoc of friendsSnapshot.docs) {
            const friendUid = friendDoc.id;
            const base = db.collection('users').doc(friendUid);
            // Ce compte dans leur liste d'amis
            crossBatch.delete(base.collection('friends').doc(uid));
            // Demandes reçues de ce compte
            crossBatch.delete(base.collection('friendRequests').doc(uid));
            // Demandes envoyées vers ce compte
            crossBatch.delete(base.collection('friendRequestsSent').doc(uid));
            crossCount++;
        }

        // Supprimer aussi les demandes en attente envoyées par ce compte (chez les destinataires)
        const sentSnapshot = await userDocRef.collection('friendRequestsSent').get();
        for (const sentDoc of sentSnapshot.docs) {
            const toUid = sentDoc.id;
            crossBatch.delete(db.collection('users').doc(toUid).collection('friendRequests').doc(uid));
        }

        // Supprimer aussi les demandes reçues par ce compte (chez les expéditeurs)
        const receivedSnapshot = await userDocRef.collection('friendRequests').get();
        for (const receivedDoc of receivedSnapshot.docs) {
            const fromUid = receivedDoc.id;
            crossBatch.delete(db.collection('users').doc(fromUid).collection('friendRequestsSent').doc(uid));
        }

        if (crossCount > 0 || !sentSnapshot.empty || !receivedSnapshot.empty) {
            await crossBatch.commit();
            console.log(`✅ Données croisées nettoyées chez ${crossCount} ami(s).`);
        } else {
            console.log(`ℹ️  Aucune donnée croisée à nettoyer.`);
        }

        // 7. Supprimer le document utilisateur (Profil)
        console.log(`🗑️ Suppression du profil utilisateur Firestore...`);
        await userDocRef.delete();

        // 8. Supprimer définitivement le compte Firebase Auth
        console.log(`🗑️ Suppression du compte Firebase Auth...`);
        await auth.deleteUser(uid);

        console.log(`🎉 Succès ! Le compte "${email}" et toutes ses données (amis, notifications, sessions) ont été complètement purgés.`);

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
