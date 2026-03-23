# Next Pitch — MVP demo

Fake-money prototype for a “next pitch” microbetting concept. Built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, and a tiny **JSON file** for balance + bet history.

## Prerequisites

- [Node.js](https://nodejs.org/) **18.18+** (LTS recommended) — includes `npm`.

## Install

```bash
cd "/Users/ezekielwagner/Documents/Next Pitch"
npm install
```

## Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## What was generated

- `src/app/` — pages (`/`, `/game/[gamePk]`) and API routes under `src/app/api/`
- `src/lib/` — odds math, MLB helpers, market labels
- `data/store.json` — fake balance + bets (edit or delete to reset)
- `data/probabilities.json` — simple per-bucket demo probabilities

## Scripts

| Command       | Purpose              |
| ------------- | -------------------- |
| `npm run dev` | Local dev server     |
| `npm run build` | Production build   |
| `npm run start` | Run production build |
| `npm run lint`  | ESLint               |

## Reset fake money

Stop the dev server, set `data/store.json` back to:

```json
{
  "balance": 1000,
  "defaultUnitSize": 10,
  "bets": []
}
```

Then start `npm run dev` again.
# next-pitch
