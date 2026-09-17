# doctor_website_demo

React + Vite + Supabase demo for the doctor course site.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in Supabase values
```

## Dev

```bash
npm run dev
```

## Seed demo data

Requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (seed-only — never prefix with `VITE_`).

```bash
npm run seed
```

## Instructor courses table

Run `scripts/ensure-instructor-courses.sql` once in the Supabase SQL editor before seeding instructor course assignments.

## Checks

```bash
npx tsc -b
npm run lint
```
