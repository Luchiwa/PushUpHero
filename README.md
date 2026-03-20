# Push-Up Hero 💪

A real-time AI workout app. Your webcam analyzes your posture, counts your reps, and tracks your progress in the cloud — no equipment needed, just a browser.

## Features

- **Real-time AI detection** — MediaPipe analyzes your posture and counts reps automatically
- **Multi-exercise workouts** — Push-ups, squats, and more to come. Chain multiple exercises into a full workout
- **Level system** — Every rep contributes XP and levels you up
- **Two session modes** — Rep goal or timer, configurable per exercise
- **Configurable rest** — Rest time between sets and between exercises
- **Session history** — Review all past sessions with per-set breakdowns
- **Friends system** — Add friends by username, view their stats, send encouragements
- **Push notifications** — Get notified when a friend sends a request or encouragement
- **Cloud sync** — Seamless sync via Firebase (Auth + Firestore + Storage)
- **Guest mode** — Play without an account, everything is saved locally in the browser
- **PWA** — Installable on mobile and desktop like a native app

---

## Prerequisites

- [Node.js 18+](https://nodejs.org/) — check with `node -v`
- A [Firebase](https://firebase.google.com/) account (free, Spark plan is enough to get started)

---

## 1. Clone the project

```bash
git clone https://github.com/Luchiwa/PushUpHero.git
cd PushUpHero
npm install
```

---

## 2. Set up Firebase

> If you just want to run the app locally without cloud features, skip to step 3 — the app works in offline guest mode.

### 2.1 Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project**, give it a name (e.g. `pushup-hero`)
3. Disable Google Analytics if you don't need it (optional)

### 2.2 Enable Authentication

1. Left menu: **Build → Authentication → Get started**
2. **Sign-in method** tab → enable **Email/Password** and **Google**

### 2.3 Create the Firestore database

1. **Build → Firestore Database → Create database**
2. Choose **Production** mode
3. Pick the region closest to you (e.g. `europe-west1`)
4. Once created, go to the **Rules** tab and replace the content with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;

      match /sessions/{sessionId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      match /notifications/{notifId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

### 2.4 Enable Firebase Storage (avatars)

1. **Build → Storage → Get started**
2. Choose the same region as Firestore
3. In the **Rules** tab, replace with:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /avatars/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId
                   && request.resource.size < 2 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
  }
}
```

### 2.5 Configure CORS for Storage (required for localhost)

The `cors.json` file is already at the root of the project. Apply it once with `gsutil`:

```bash
# Install gcloud SDK if not already installed:
#   macOS  → brew install --cask google-cloud-sdk
#   others → https://cloud.google.com/sdk/docs/install

gcloud auth login
gsutil cors set cors.json gs://YOUR_STORAGE_BUCKET
```

Replace `YOUR_STORAGE_BUCKET` with the value of `VITE_FIREBASE_STORAGE_BUCKET` from your `.env` (e.g. `pushup-hero-ad32d.firebasestorage.app`).

> Without this step, avatars still display — but a CORS error will appear in the dev console.

### 2.6 Get your Firebase config keys

1. **Project Settings** (gear icon, top left) → **General** tab
2. Scroll to **Your apps** → click **Add app** → Web icon (`</>`)
3. Give it a name (e.g. `pushup-hero-web`), **do not check** Firebase Hosting
4. Copy the `firebaseConfig` object shown

---

## 3. Configure environment variables

Create a `.env` file at the project root (next to `package.json`):

```env
VITE_FIREBASE_API_KEY="your-value"
VITE_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your-project-id"
VITE_FIREBASE_STORAGE_BUCKET="your-project.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID="123456789"
VITE_FIREBASE_APP_ID="1:123456789:web:abcdef"
VITE_FIREBASE_MEASUREMENT_ID="G-XXXXXXXXXX"

# Optional — for Push Notifications (see section 5)
VITE_FIREBASE_VAPID_KEY=""
```

> The `.env` file is in `.gitignore` — it will never be committed.

---

## 4. Run locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser. Camera access will be requested on launch.

---

## 5. (Optional) Push Notifications

Notifications require Firebase Cloud Messaging and Cloud Functions.

### 5.1 Generate a VAPID key

1. **Project Settings → Cloud Messaging** → **Web configuration** section
2. Click **Generate key pair** under *Web Push certificates*
3. Copy the key and add it to `.env`: `VITE_FIREBASE_VAPID_KEY="your-vapid-key"`

### 5.2 Deploy Cloud Functions

```bash
npm install -g firebase-tools
firebase login
cd functions && npm install && cd ..
firebase deploy --only functions
```

> Functions are in `functions/src/index.ts`. They run on `europe-west1` and send a Push notification whenever a document is created in `users/{uid}/notifications`.

---

## 6. Deploy to production

The project deploys to Firebase Hosting:

```bash
npm run deploy
# equivalent to: npm run build && firebase deploy --only hosting
```

Make sure you're logged in (`firebase login`) and that `.firebaserc` points to your project.

---

## Tech stack

| Layer | Tech |
|---|---|
| UI | React 19 + TypeScript |
| Build | Vite 7 |
| Styling | SCSS with design tokens |
| AI / Pose | MediaPipe Tasks Vision |
| Backend | Firebase (Auth, Firestore, Storage, Functions) |
| Push | Firebase Cloud Messaging (FCM) |
| PWA | vite-plugin-pwa + Service Worker |

---

## Project structure

```
src/
├── app/            # App.tsx, workout state machine, providers
├── components/     # Shared components (PoseOverlay, DragNumberPicker…)
├── exercises/      # Exercise detectors (PushUpDetector, SquatDetector…)
├── hooks/          # React hooks (camera, pose, auth, sessions…)
├── lib/            # Firebase init, constants
├── overlays/       # Camera overlays (Dashboard, VictoryOverlay…)
├── screens/        # Main screens (StartScreen, SummaryScreen…)
└── styles/         # SCSS variables, mixins, reset
functions/          # Firebase Cloud Functions (Push notifications)
cors.json           # CORS config for Firebase Storage
```
