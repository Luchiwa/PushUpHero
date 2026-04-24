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

- [Node.js 20](https://nodejs.org/) — pinned via `.nvmrc`; check with `node -v`
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

### 2.4 Enable Firebase Storage (avatars)

1. **Build → Storage → Get started**
2. Choose the same region as Firestore

### 2.5 Deploy security rules

Rules live in `firestore.rules` and `storage.rules` at the repo root. Deploy them from source:

```bash
npm install -g firebase-tools   # if not already installed
firebase login
npm run deploy:rules
```

> Do **not** edit rules from the Firebase Console — changes made there will be overwritten on the next `npm run deploy:rules`. Always change rules via a PR.

To iterate locally without touching prod, run the Firebase emulators:

```bash
npm run emulators
# Firestore: http://localhost:8080
# Storage:   http://localhost:9199
# Auth:      http://localhost:9099
# UI:        http://localhost:4000
```

### 2.6 Configure CORS for Storage (required for localhost)

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

### 2.7 Get your Firebase config keys

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

## 7. Continuous Integration

Two GitHub Actions workflows live in `.github/workflows/`:

- **`ci.yml`** — runs on every pull request to `main`:
  - `frontend` job: `npm ci` → `npm run lint` → `npm run typecheck` → `npm run build`
  - `functions` job: `npm ci` + `npm run build` inside `functions/`, skipped when no `functions/**` files changed
  - `preview` job: publishes the built `dist/` to a Firebase Hosting preview channel named `pr-<number>` and posts the preview URL as a bot comment on the PR. The comment is updated in place on subsequent pushes and the channel auto-expires after 7 days.

- **`deploy.yml`** — runs on every push to `main`, plus manually via *Actions → Deploy → Run workflow*:
  - Only targets whose files changed in the push are deployed (hosting / functions / firestore rules / storage rules). A docs-only push skips the deploy entirely; a functions-only push skips the frontend build.
  - Trigger manually with the *Force* checkbox to redeploy all four targets regardless of the diff (use this if rules drifted from a Firebase Console edit, or after a rollback).

### 7.1 Required GitHub secrets and variables

Under **Settings → Secrets and variables → Actions**:

| Name | Kind | Value |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Secret | Full JSON of a Firebase service-account key |
| `FIREBASE_PROJECT_ID` | Variable | Your Firebase project ID (the same one in `.firebaserc`) |
| `VITE_FIREBASE_ENV` | Secret | Raw contents of the local `.env` file (all `VITE_FIREBASE_*` keys, one per line). The build step writes it to `.env` before `vite build` so the config is embedded in the shipped bundle. |

### 7.2 Initial setup

The easiest path is to let the Firebase CLI wire it up:

```bash
firebase init hosting:github
```

This:
1. Creates a dedicated service account with the minimal Firebase roles.
2. Uploads the JSON key as a GitHub secret (by default named `FIREBASE_SERVICE_ACCOUNT_<PROJECT_ID>`).
3. Drops a starter workflow file.

Post-setup:
- Rename the generated secret to `FIREBASE_SERVICE_ACCOUNT` (or edit both workflows to match the generated name).
- Delete the starter workflow file the CLI created — this repo uses the hand-written `ci.yml` / `deploy.yml`.
- Add the `FIREBASE_PROJECT_ID` **variable** (not a secret) under the same settings page.

### 7.3 Rotating secrets

**`FIREBASE_SERVICE_ACCOUNT`** — if the service-account key leaks or you rotate periodically:

1. Firebase Console → **Project Settings → Service accounts → Generate new private key** → download the JSON.
2. GitHub → **Settings → Secrets and variables → Actions → `FIREBASE_SERVICE_ACCOUNT`** → *Update secret* → paste the new JSON.
3. Re-run the latest workflow via **Re-run jobs** to confirm the new key works, then revoke the old key in the Firebase Console.

**`VITE_FIREBASE_ENV`** — after any change to a `VITE_FIREBASE_*` value in your local `.env` (new project, rotated web API key, etc.):

```bash
gh secret set VITE_FIREBASE_ENV --repo <owner>/<repo> < .env
```

### 7.4 Branch protection (recommended)

After the first run of each workflow, under **Settings → Branches → Branch protection rules** for `main`, require the `frontend` and `preview` checks to pass before merging.

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
