# MedLearn CME demo

This repository contains a React and Supabase continuing medical education demo. The runnable app is in `doctor_website_demo/`. The root `package.json` does not provide app commands.

## Start the app

Use Node.js 22.12 or later in the 22.x line, 24.x, or 26 and later. These ranges come from the app lockfile's Vitest requirement. Node.js 20 can satisfy Vite's engine range but cannot run this locked test suite.

From the repository root, run:

```bash
cd doctor_website_demo
npm ci
cp -n .env.example .env.local
```

Edit `.env.local` with your disposable Supabase project's public URL and anon key. Replace or remove the example role IDs. Follow the [app setup guide](doctor_website_demo/README.md) for the database prerequisites and Auth redirects, then run:

```bash
npm run dev
```

Open the URL that Vite prints. The configured port is 5178.

## Check the app

Run these commands from `doctor_website_demo/`:

```bash
npm run lint
npm test
npm run build
npm run preview
```

`build` runs TypeScript checks and writes the static bundle to `doctor_website_demo/dist/`. `preview` serves that bundle locally.

## Release status

RLS is intentionally disabled for rapid application development. Browser route guards do not protect database access. Use synthetic data in a disposable project. Booking and payment, authoritative grades, official certificates, and production authorization remain incomplete.

Use the [release checklist](doctor_website_demo/RELEASE_CHECKLIST.md) to record evidence before a deployment. Passing local checks does not establish that hosted Auth flows or production access controls work.

The [V1 implementation plan](doctor_website_demo/V1_IMPLEMENTATION_PLAN.md) preserves implementation history and deferred work. Root [IMPLEMENTATION.md](IMPLEMENTATION.md) and older audit reports are historical. Their branch names, credentials, and setup examples do not define current setup or require a particular branch.
