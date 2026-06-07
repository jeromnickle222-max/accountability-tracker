# Accountability Tracker

A personal daily habit tracker with point scoring, weekly grid, history heatmap, and financial accountability ledger. Built with React + Firebase Firestore. Self-hostable — your data stays in your own Firebase project.

![Accountability Tracker](https://img.shields.io/badge/React-18-blue) ![Firebase](https://img.shields.io/badge/Firebase-10-orange)

## Features

- ✅ Daily habit check-ins with point values
- 🔢 Counter-style habits (e.g. meditation sessions)
- ⚠️ Penalty habit tracking with ledger logging
- 📅 Weekly grid view
- 🗓 42-day history heatmap
- 💰 Financial ledger with accountability partner balance
- ⚙️ Customizable point values
- 📱 Mobile-friendly, add to home screen

## One-click deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/accountability-tracker&env=VITE_FIREBASE_API_KEY,VITE_FIREBASE_AUTH_DOMAIN,VITE_FIREBASE_PROJECT_ID,VITE_FIREBASE_STORAGE_BUCKET,VITE_FIREBASE_MESSAGING_SENDER_ID,VITE_FIREBASE_APP_ID)

## Self-hosting setup

### 1. Firebase

1. Go to [firebase.google.com](https://firebase.google.com) and create a free project
2. Enable **Firestore Database** (start in test mode)
3. Go to Project Settings → Add a Web App → copy the config

### 2. Clone and configure

```bash
git clone https://github.com/YOUR_USERNAME/accountability-tracker
cd accountability-tracker
npm install
cp .env.example .env
```

Fill in your `.env` with your Firebase config values:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### 3. Run locally

```bash
npm run dev
```

### 4. Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Add your `.env` variables in the Vercel dashboard under Project → Settings → Environment Variables.

## Customizing habits

Edit `src/habits.js` to change habits, point values, categories, and your accountability partner's name.

## Tech stack

- [React 18](https://react.dev)
- [Vite](https://vitejs.dev)
- [Firebase Firestore](https://firebase.google.com/docs/firestore)
- [Vercel](https://vercel.com) (hosting)

## License

MIT — use it, fork it, make it yours.
