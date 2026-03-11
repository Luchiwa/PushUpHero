# Push-Up Hero 💪

Un jeu web interactif en Réalité Augmentée (IA) qui compte tes pompes en temps réel grâce à la webcam, suit ta progression dans le Cloud, et te donne un feedback audio/visuel dynamique pour t'encourager.

## 🚀 Fonctionnalités

- **Détection IA en temps réel** : Utilise TensorFlow.js (MoveNet) pour analyser ta posture et compter tes répétitions automatiquement.
- **Progression & Niveaux** : Un système d'expérience (XP) où chaque pompe te fait monter en niveau, avec un aperçu du niveau suivant.
- **Deux modes de session** :
  - 🔢 **Mode Répétitions** : Définis un objectif de reps à atteindre. La session se termine automatiquement une fois l'objectif atteint.
  - ⏱️ **Mode Chronomètre** : Définis une durée (minutes / secondes). Fais un maximum de pompes avant la fin du temps.
- **Historique des sessions** : Consulte tes sessions passées directement depuis ton profil.
- **Système d'amis** : Ajoute des amis par pseudonyme, envoie et accepte des demandes d'amis, et consulte leur profil depuis le tien.
- **Sauvegarde Cloud Firebase** : Synchronisation de tes sessions d'entraînement et de ton niveau de manière transparente.
- **Mode Invité (Offline)** : Joue sans compte, tes données sont enregistrées localement dans ton navigateur.
- **Retour audio/visuel** : Sons de feedback à chaque répétition, animations flottantes sur le compteur, et overlay de victoire à la fin d'une session.
- **Guide de position** : Indication visuelle en temps réel si ta posture sort du cadre de détection.
- **PWA Ready** : Installable sur mobile et bureau pour une expérience native.

---

## 🛠️ Pré-requis

Avant de lancer le projet, assure-toi d'avoir installé sur ta machine :

- [Node.js](https://nodejs.org/) (Version 18+ recommandée)
- [npm](https://www.npmjs.com/) ou [pnpm](https://pnpm.io/)

---

## ⚙️ Configuration Initiale (Environnement)

Ce projet nécessite une configuration Firebase pour fonctionner, notamment pour l'authentification et la base de données de scores.

1. Crée un fichier nommé `.env` à la racine du projet (au même niveau que `package.json`).
2. Ajoute les variables d'environnement suivantes dans ce fichier (remplace les valeurs par celles de ton projet Firebase) :

```env
VITE_FIREBASE_API_KEY="ton-api-key"
VITE_FIREBASE_AUTH_DOMAIN="ton-projet.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="ton-projet-id"
VITE_FIREBASE_STORAGE_BUCKET="ton-projet.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID="sender-id"
VITE_FIREBASE_APP_ID="app-id"
VITE_FIREBASE_MEASUREMENT_ID="G-mesure"
```

> **Attention :** Le fichier `.env` est exclu du dépôt Git (via `.gitignore`) pour des raisons de sécurité. Ne commite jamais tes clés en clair si tu n'en as pas besoin.

---

## 💻 Démarrage du projet

Une fois ton fichier `.env` configuré, ouvre un terminal dans le dossier du projet et exécute les commandes suivantes :

### 1. Installer les dépendances

```bash
npm install
# ou
pnpm install
```

### 2. Lancer le serveur de développement

```bash
npm run dev
# ou
pnpm run dev
```

Le projet sera accessible sur ton navigateur à l'adresse : `http://localhost:5173`. L'autorisation d'accès à la webcam est requise pour utiliser l'application.

### 3. Compiler pour la production

```bash
npm run build
# ou
pnpm run build
```

Le code de production optimisé sera généré dans le dossier `/dist`.

---

## 🏗️ Stack Technique

- **React.js** (Vite)
- **TypeScript**
- **Sass (SCSS)** pour le styling modulé
- **TensorFlow.js (Pose Detection)**
- **Firebase** (Auth, Firestore)
- **Vite PWA Plugin**
